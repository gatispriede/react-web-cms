import {spawn, ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import path from 'node:path';

// DECISION: two server modes, picked by `PLAYWRIGHT_E2E_PROD`.
//
//   - dev mode (default, smoke + iteration): spawn `next dev` per worker.
//     Trades ~15s/worker boot for not needing a build, fine for smoke
//     where the chain runs once.
//
//   - prod mode (e2e:full): spawn `next start` per worker against a
//     SINGLE pre-built `.next/` produced by the `e2e:full:build` script.
//     Workers share the build output read-only — `next start` only reads
//     it at boot, so N workers + 1 build is safe and the per-worker boot
//     drops to ~2s. The full suite running 30+ specs would otherwise pay
//     a 15s × workers cold-start tax + per-route Turbopack compiles on
//     every first navigation.
//
// DECISION: HMR is disabled (`NEXT_DISABLE_HMR=1`) for dev mode so a slow
// filesystem poll mid-test doesn't trip a recompile while a test is
// navigating. In prod mode the flag is moot — `next start` doesn't watch.

export interface E2EServerHandle {
    url: string;       // http://localhost:<port>
    port: number;
    stop: () => Promise<void>;
}

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const NEXT_DIR = path.join(REPO_ROOT, 'ui/client');

async function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, 'localhost', () => {
            const addr = srv.address();
            if (addr && typeof addr === 'object') {
                const port = addr.port;
                srv.close(() => resolve(port));
            } else {
                srv.close();
                reject(new Error('failed to allocate a port'));
            }
        });
    });
}

async function waitForReady(url: string, timeoutMs = 120_000): Promise<void> {
    const started = Date.now();
    let lastErr: unknown;
    // We treat ANY HTTP response (including 5xx) as "the dev server is up."
    // A 500 from a broken page still proves the runtime is reachable — the
    // browser should still launch so the spec / human can see what's wrong.
    // The fetch error path catches the real "not yet listening" state.
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url, {redirect: 'manual'});
            // Any HTTP status means the server is alive.
            if (res.status > 0) return;
        } catch (err) {
            lastErr = err;
        }
        await new Promise(r => setTimeout(r, 750));
    }
    throw new Error(`next dev not ready after ${timeoutMs}ms: ${String(lastErr)}`);
}

export async function startServer(opts: {mongoUri: string; workerIndex: number}): Promise<E2EServerHandle> {
    // If the developer already has a `next dev` running and explicitly opted
    // in via the `e2e:dev` script, reuse it instead of booting our own. This
    // is the iterate-on-one-spec workflow from the spec.
    if (process.env.PLAYWRIGHT_E2E_REUSE_DEV) {
        const reuseUrl = process.env.PLAYWRIGHT_E2E_REUSE_URL ?? 'http://localhost:80';
        const u = new URL(reuseUrl);
        return {
            url: reuseUrl,
            port: Number(u.port || 80),
            stop: async () => {/* operator owns this server */},
        };
    }

    const port = await findFreePort();
    const url = `http://localhost:${port}`;

    // Prod mode reads the prebuilt `.next-e2e/` produced by
    // `pnpm e2e:full:build`. Workers share the build read-only — Next
    // only touches it during boot, so N starts + 1 build is safe.
    const isProd = !!process.env.PLAYWRIGHT_E2E_PROD;

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        MONGODB_URI: opts.mongoUri,
        NEXT_DISABLE_HMR: '1',
        // E2E_RUN gates the in-memory rate-limit hike in authOptions.ts
        // (`signin:<ip>` and `signin-customer:<ip>`). Without this set,
        // prod-mode workers hit the 5/min cap after the first 4–5 admin
        // signins (especially with retries) and every subsequent test
        // bounces with "Too many attempts".
        E2E_RUN: '1',
        ADMIN_DEFAULT_PASSWORD: 'test-admin-pw',
        ADMIN_EMAIL: 'admin@admin.com',
        ADMIN_USERNAME: 'Admin',
        NEXTAUTH_SECRET: 'e2e-secret',
        NEXTAUTH_URL: url,
        // Server-side gqty (used by NextAuth.authorize) defaults to
        // `http://server:<BUILD_PORT>/` (docker) or `:80` (local). Workers
        // run on random free ports, so we must point gqty's SSR fetch at
        // the worker's own server, otherwise the user lookup falls
        // through to a non-existent server and authorize() returns
        // "wrong email or password" for everyone.
        INTERNAL_GRAPHQL_URL: `${url}/api/graphql`,
        // Lower bcrypt cost — bcrypt.compare on the default 10 rounds is
        // ~80ms per attempt, which is fine in prod but compounds across
        // the lockout-hammering test. 4 rounds is still real bcrypt
        // (so the hashing path is exercised) without dominating wall time.
        BCRYPT_ROUNDS: '4',
        PORT: String(port),
        // Both build & start consult `E2E_BUILD_DIR` via next.config.js so
        // the prebuilt artefacts live in `ui/client/.next-e2e/` and the
        // local dev server's own `.next/` stays pristine.
        ...(isProd ? {NODE_ENV: 'production', E2E_BUILD_DIR: '.next-e2e'} : {}),
    };

    // dev mode → `next dev`; prod mode → `next start` against the shared
    // `.next-e2e/` build. Both invoke the same binary entrypoint with
    // different verbs.
    const child: ChildProcess = spawn(
        process.execPath,
        [
            path.join(REPO_ROOT, 'node_modules/next/dist/bin/next'),
            isProd ? 'start' : 'dev',
            '-p', String(port),
            NEXT_DIR,
        ],
        {
            cwd: REPO_ROOT,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            // detached: false on purpose — we want the child to die with the
            // worker if Playwright SIGKILLs us.
        },
    );

    let exited = false;
    child.on('exit', () => { exited = true; });

    // Surface compile errors when a spec hangs on waitForReady — silent
    // child stderr is the worst flake to debug.
    if (process.env.PLAYWRIGHT_E2E_VERBOSE) {
        child.stdout?.on('data', d => process.stdout.write(`[w${opts.workerIndex}] ${d}`));
        child.stderr?.on('data', d => process.stderr.write(`[w${opts.workerIndex}] ${d}`));
    }

    try {
        await waitForReady(url);
    } catch (err) {
        try { child.kill('SIGKILL'); } catch {/* noop */}
        throw err;
    }

    return {
        url,
        port,
        stop: async () => {
            if (exited) return;
            try {
                child.kill('SIGTERM');
            } catch {/* noop */}
            // Give the server a beat to flush; SIGKILL after 3s.
            await new Promise<void>(resolve => {
                const t = setTimeout(() => {
                    try { child.kill('SIGKILL'); } catch {/* noop */}
                    resolve();
                }, 3000);
                child.once('exit', () => { clearTimeout(t); resolve(); });
            });
        },
    };
}
