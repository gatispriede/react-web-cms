#!/usr/bin/env node
/**
 * Production build for the GHCR-pushed image (Wave 1 Terraform/Kamal
 * migration — `docs/runbooks/kamal-deploy.md`).
 *
 * Mirrors the same problem `tools/e2e-build.js` solves: `next build` calls
 * `gqlFetch` from `getStaticPaths` / `getStaticProps`, so the build needs
 * a live GraphQL endpoint. In CI the droplet's mongo doesn't exist yet —
 * we boot an ephemeral `mongodb-memory-server` + `standalone-graphql`
 * pair, run `next build` against them, then tear it all down. The
 * pre-rendered routes still call `getStaticProps` against an empty mongo,
 * which is fine because every dynamic route uses `fallback: 'blocking'`
 * so the runtime droplet regenerates pages with real content on first
 * hit.
 *
 * Different from `tools/e2e-build.js`:
 *   - writes to default `.next/` (not `.next-e2e/`) — this is the path
 *     `next start` reads in production
 *   - `NODE_ENV=production` end-to-end (e2e build leaves it inheritable)
 *   - exit code is the build exit code; nothing else is consumed (CI
 *     consumes it as a pass/fail gate, not a fixture for tests)
 *
 * The multi-stage `infra/AppDockerfile` invokes this script inside the
 * builder stage; the runtime stage just copies the prebuilt artefacts +
 * `node_modules` and runs `next start`. Removing the at-startup `next
 * build` is the deploy-cold-start win the migration is targeting
 * (~6-8 min → ~30 s).
 */
const {spawn} = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');

function findFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
    });
}

async function waitForGraphql(url, timeoutMs = 60_000) {
    const start = Date.now();
    let last;
    while (Date.now() - start < timeoutMs) {
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: '{ __typename }'}),
            });
            if (r.status > 0) return;
        } catch (e) { last = e; }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`graphql not ready after ${timeoutMs}ms: ${String(last)}`);
}

async function main() {
    process.stdout.write('[docker-prebuild] starting memory-mongo… ');
    const {MongoMemoryServer} = require('mongodb-memory-server');
    const mongo = await MongoMemoryServer.create();
    const mongoUri = mongo.getUri();
    process.stdout.write(`ready (${mongoUri})\n`);

    const gqlPort = await findFreePort();
    const gqlUrl = `http://localhost:${gqlPort}/api/graphql`;
    process.stdout.write(`[docker-prebuild] starting standalone-graphql on :${gqlPort}… `);

    // Fresh tmp dir for the bootstrap-admin artefact — same reason as
    // e2e-build (avoids inheriting a stale dev-run artefact and tripping
    // the "stale artefact, no admin" guard).
    const initialPwDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-prebuild-initpw-'));

    const gqlChild = spawn(
        process.execPath,
        [
            path.join(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs'),
            '--tsconfig', path.join(REPO_ROOT, 'services/tsconfig.custom.json'),
            path.join(REPO_ROOT, 'services/index.ts'),
        ],
        {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                MONGODB_URI: mongoUri,
                STANDALONE_PORT: String(gqlPort),
                INITIAL_PASSWORD_DIR: initialPwDir,
                // Compose every feature so the schema is complete at
                // build time. Runtime droplet still picks per-feature
                // env from the deploy config.
                FEATURE_PRODUCTS: 'true',
                FEATURE_CART: 'true',
                FEATURE_INVENTORY: 'true',
                FEATURE_ORDERS: 'true',
                FEATURE_MCP: 'true',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    const verbose = !!process.env.PREBUILD_VERBOSE;
    if (verbose) {
        gqlChild.stdout?.on('data', d => process.stdout.write(`[gql] ${d}`));
        gqlChild.stderr?.on('data', d => process.stderr.write(`[gql] ${d}`));
    }
    await waitForGraphql(gqlUrl);
    process.stdout.write('ready\n');

    process.stdout.write(`[docker-prebuild] running next build --webpack → .next/\n`);
    const nextBin = path.join(REPO_ROOT, 'node_modules/next/dist/bin/next');
    const build = spawn(
        process.execPath,
        // `--webpack` pin: same reason as `package.json#build` — Next 16
        // defaults `next build` to Turbopack which rejects the existing
        // `webpack:` block in `ui/client/next.config.js`. Without the
        // flag the build aborts before emitting any pages.
        [nextBin, 'build', '--webpack', 'ui/client'],
        {
            cwd: REPO_ROOT,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'production',
                GRAPHQL_ENDPOINT: gqlUrl,
                INTERNAL_GRAPHQL_URL: gqlUrl,
                INITIAL_PASSWORD_DIR: initialPwDir,
                MONGODB_URI: mongoUri,
                FEATURE_PRODUCTS: 'true',
                FEATURE_CART: 'true',
                FEATURE_INVENTORY: 'true',
                FEATURE_ORDERS: 'true',
                FEATURE_MCP: 'true',
            },
        },
    );
    const buildExit = await new Promise(resolve => build.on('exit', code => resolve(code ?? 1)));

    process.stdout.write('[docker-prebuild] tearing down…\n');
    try { gqlChild.kill('SIGTERM'); } catch {/* noop */}
    await new Promise(r => setTimeout(r, 500));
    try { gqlChild.kill('SIGKILL'); } catch {/* noop */}
    await mongo.stop();

    process.exit(buildExit);
}

main().catch(err => {
    console.error('[docker-prebuild] fatal:', err);
    process.exit(1);
});
