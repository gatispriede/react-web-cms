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
    const build = spawn(
        process.execPath,
        [nextBin, 'build', 'ui/client'],
        {
            cwd: REPO_ROOT,
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'production',
                E2E_BUILD_DIR: '.next-e2e',
                GRAPHQL_ENDPOINT: gqlUrl,
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
