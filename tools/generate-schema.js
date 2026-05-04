#!/usr/bin/env node
/**
 * Regenerate the gqty client without depending on a running dev server.
 *
 * Mirrors `tools/e2e-build.js`:
 *   1. spin up an empty `mongodb-memory-server`
 *   2. spin up the standalone GraphQL on a free port
 *   3. point `@gqty/cli` at it; codegen writes to `services/api/generated/`
 *   4. tear everything down
 *
 * Run after editing `services/api/schema.graphql`. Output should be
 * checked in — the generated client is read by every API client and by
 * the build's gqlFetch, so a regen + commit is a single atomic change.
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
    process.stdout.write('[gen-schema] starting memory-mongo… ');
    const {MongoMemoryServer} = require('mongodb-memory-server');
    const mongo = await MongoMemoryServer.create();
    process.stdout.write(`ready\n`);

    const gqlPort = await findFreePort();
    const gqlUrl = `http://localhost:${gqlPort}/api/graphql`;
    process.stdout.write(`[gen-schema] starting standalone-graphql on :${gqlPort}… `);
    const gqlChild = spawn(
        process.execPath,
        [
            path.join(REPO_ROOT, 'node_modules/tsx/dist/cli.mjs'),
            '--tsconfig', path.join(REPO_ROOT, 'services/tsconfig.custom.json'),
            path.join(REPO_ROOT, 'services/index.ts'),
        ],
        {
            cwd: REPO_ROOT,
            env: {...process.env, MONGODB_URI: mongo.getUri(), STANDALONE_PORT: String(gqlPort)},
            stdio: ['ignore', 'pipe', 'pipe'],
        },
    );
    if (process.env.GEN_SCHEMA_VERBOSE) {
        gqlChild.stdout?.on('data', d => process.stdout.write(`[gql] ${d}`));
        gqlChild.stderr?.on('data', d => process.stderr.write(`[gql] ${d}`));
    }
    await waitForGraphql(gqlUrl);
    process.stdout.write('ready\n');

    process.stdout.write(`[gen-schema] running @gqty/cli → services/api/generated/\n`);
    // `@gqty/cli` isn't a hard dep — install on demand via npx so a fresh
    // clone doesn't need an extra `npm install -D @gqty/cli` step.
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const gen = spawn(
        npxCmd,
        ['@gqty/cli', gqlUrl, '--target=services/api/generated/index.ts'],
        {cwd: REPO_ROOT, stdio: 'inherit', env: process.env, shell: process.platform === 'win32'},
    );
    const exit = await new Promise(resolve => gen.on('exit', code => resolve(code ?? 1)));

    process.stdout.write('[gen-schema] tearing down…\n');
    try { gqlChild.kill('SIGTERM'); } catch {/* noop */}
    await new Promise(r => setTimeout(r, 500));
    try { gqlChild.kill('SIGKILL'); } catch {/* noop */}
    await mongo.stop();

    process.exit(exit);
}

main().catch(err => {
    console.error('[gen-schema] fatal:', err);
    process.exit(1);
});
