#!/usr/bin/env node
/**
 * Production build for E2E that doesn't depend on the local dev server.
 *
 * The build's `getStaticPaths` / `getStaticProps` (`pages/[...slug]`,
 * `/blog`, `/products`) call `gqlFetch` against the GraphQL endpoint at
 * compile time. Previously that meant pointing at the dev server on
 * `localhost:80` — and a dev-server hiccup would tank the build with
 * cryptic `Cannot read properties of undefined (reading 'text')` errors
 * inside ISR worker chunks.
 *
 * This script removes the dependency by spinning up its own services:
 *   1. `mongodb-memory-server` — empty mongo on a random ephemeral port
 *   2. `standalone-graphql` (services/index.ts) — Apollo over Express
 *      against the temp mongo, on a free port we pick here
 *   3. `next build ui/client` with `GRAPHQL_ENDPOINT` pointed at (2) and
 *      `E2E_BUILD_DIR=.next-e2e` so output lands in the e2e dist
 *
 * The standalone server returns empty arrays for all `getNavigationCollection`
 * / `getPosts` / `getProducts` queries (no data was seeded), so the build
 * is "stateless" — pages are not pre-rendered with content. That's fine
 * because every dynamic route uses `fallback: 'blocking'`; runtime workers
 * regenerate pages on first hit against their own per-worker memory mongo.
 */
const {spawn} = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

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

async function waitForGraphql(url, timeoutMs = 30_000) {
    const start = Date.now();
    let last;
    while (Date.now() - start < timeoutMs) {
        try {
            const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({query: '{ __typename }'})});
            if (r.status > 0) return;
        } catch (e) { last = e; }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`graphql not ready after ${timeoutMs}ms: ${String(last)}`);
}

async function main() {
    // 1. Mongo — spin a single in-process memory server. Easier than the
    //    Playwright fixture path because we just need ONE instance for
    //    the build, not per-worker.
    process.stdout.write('[e2e-build] starting memory-mongo… ');
    const {MongoMemoryServer} = require('mongodb-memory-server');
    const mongo = await MongoMemoryServer.create();
    const mongoUri = mongo.getUri();
    process.stdout.write(`ready (${mongoUri})\n`);

    // 2. Standalone GraphQL on a free port (so this can run alongside the
    //    user's dev server / docker without colliding).
    const gqlPort = await findFreePort();
    const gqlUrl = `http://localhost:${gqlPort}/api/graphql`;
    process.stdout.write(`[e2e-build] starting standalone-graphql on :${gqlPort}… `);
    // Fresh tmp dir for the bootstrap-admin artefact. Without this, a
    // stale `var/admin-initial-password.txt` from a previous local dev
    // run trips the "stale artefact, no admin" guard on the empty
    // memory mongo and the standalone server can't seed.
    const fs = require('node:fs');
    const initialPwDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'e2e-initpw-'));

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
                // Build-time gqlFetch queries every public-route's
                // getStaticPaths via this standalone — including
                // /products and /cart and /checkout. Force every
                // feature on so the composed schema is complete; the
                // runtime workers can then turn features on/off via
                // their own env to exercise the gating.
                FEATURE_PRODUCTS: 'true',
                FEATURE_CART: 'true',
                FEATURE_INVENTORY: 'true',
                FEATURE_ORDERS: 'true',
                FEATURE_MCP: 'true',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    const verbose = !!process.env.E2E_BUILD_VERBOSE;
    if (verbose) {
        gqlChild.stdout?.on('data', d => process.stdout.write(`[gql] ${d}`));
        gqlChild.stderr?.on('data', d => process.stderr.write(`[gql] ${d}`));
    }
    await waitForGraphql(gqlUrl);
    process.stdout.write('ready\n');

    // 3. Run the build with GRAPHQL_ENDPOINT pointed at our standalone.
    process.stdout.write(`[e2e-build] running next build → .next-e2e/\n`);
    // Inject env directly instead of going through `cross-env` — saves a
    // child shell and dodges Windows EINVAL on spawning .cmd entrypoints.
    const nextBin = path.join(REPO_ROOT, 'node_modules/next/dist/bin/next');
    // Next 16 enables Turbopack by default for `next build` too. Our
    // `ui/client/next.config.js` carries a `webpack:` block (server-side
    // watcher tweak for the shared `services/` dir). Without an explicit
    // bundler flag the build aborts with a "Turbopack with webpack config
    // and no turbopack config" error before any pages are emitted. Pin
    // `--webpack` so the existing config is honoured. Same flag the
    // dev-mode fixture passes via `tests/e2e/fixtures/server.ts`.
    const build = spawn(
        process.execPath,
        [nextBin, 'build', '--webpack', 'ui/client'],
        {
            cwd: REPO_ROOT,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'production',
                E2E_BUILD: '1',
                E2E_BUILD_DIR: '.next-e2e',
                GRAPHQL_ENDPOINT: gqlUrl,
                // gqty's SSR fetch reads `INTERNAL_GRAPHQL_URL` first;
                // without it, fetch falls back to `localhost:80` which
                // the standalone isn't listening on. Mirror it so any
                // gqty.resolve() invoked during prerender hits the
                // same standalone gqlFetch already targets.
                INTERNAL_GRAPHQL_URL: gqlUrl,
                INITIAL_PASSWORD_DIR: initialPwDir,
                // Build process imports MongoDBConnection via the
                // service registry; without MONGODB_URI it tries to
                // dial the production Atlas URL and tanks prerender
                // with ECONNREFUSED. Point it at the same memory mongo
                // the standalone is using.
                MONGODB_URI: mongoUri,
                // Build-side ALSO needs every feature on. Some
                // getStaticProps paths import services that read the
                // registry at module load; with features off, their
                // SDL fragments + delegate methods drop and the build
                // fails composing or calling them. Mirror the standalone.
                FEATURE_PRODUCTS: 'true',
                FEATURE_CART: 'true',
                FEATURE_INVENTORY: 'true',
                FEATURE_ORDERS: 'true',
                FEATURE_MCP: 'true',
            },
        },
    );
    const buildExit = await new Promise(resolve => build.on('exit', code => resolve(code ?? 1)));

    // 4. Tear everything down. Kill graphql first so it can finish flushing
    //    its mongo connection before mongo itself stops.
    process.stdout.write('[e2e-build] tearing down…\n');
    try { gqlChild.kill('SIGTERM'); } catch {/* noop */}
    await new Promise(r => setTimeout(r, 500));
    try { gqlChild.kill('SIGKILL'); } catch {/* noop */}
    await mongo.stop();

    process.exit(buildExit);
}

main().catch(err => {
    console.error('[e2e-build] fatal:', err);
    process.exit(1);
});
