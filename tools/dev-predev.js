// `predev` hook — resilient version.
//
// Default `npm run dev:db` (`docker compose ... up -d mongodb`) is a hard
// dependency on Docker Desktop being running. When the daemon is down
// (e.g. user hasn't launched Docker yet) the hook fails and `npm run dev`
// never starts the next-server — even though Mongo might already be
// reachable on :27017 from a different process / WSL / a manual mongod.
//
// This wrapper:
//   1. Probes localhost:27017. If something answers, skip docker entirely.
//   2. Otherwise tries `docker compose ... up -d`. Success → fine.
//   3. If docker fails (daemon down, CLI missing, image pull errors), log
//      a warning and exit 0 so `npm run dev` proceeds. The next-server
//      will surface a connection error on first request — which is the
//      same thing it does on the prod droplet during cold starts.
'use strict';

const net = require('net');
const { spawnSync } = require('child_process');

function isPortOpen(port, host = '127.0.0.1', timeoutMs = 800) {
    return new Promise((resolve) => {
        const sock = net.connect(port, host);
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            try { sock.destroy(); } catch (_) { /* noop */ }
            resolve(ok);
        };
        sock.once('connect', () => finish(true));
        sock.once('error', () => finish(false));
        setTimeout(() => finish(false), timeoutMs);
    });
}

async function main() {
    if (await isPortOpen(27017)) {
        console.log('[predev] mongo reachable on :27017, skipping docker compose');
        return 0;
    }
    console.log('[predev] mongo not reachable on :27017 — trying docker compose...');
    const r = spawnSync('docker', ['compose', '-f', 'infra/compose.dev.yaml', 'up', '-d'], {
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (r.status === 0) return 0;
    console.warn(
        '[predev] docker compose failed (status=' + r.status +
        '). The next-server will start anyway — if Mongo is not running ' +
        'externally, sign-in / GraphQL calls will fail with ECONNREFUSED. ' +
        'Start Docker Desktop and re-run `npm run dev:db`, or launch a ' +
        'mongod on :27017 by other means.',
    );
    return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
    console.error('[predev] unexpected error:', err);
    process.exit(0); // never block the dev server from starting
});
