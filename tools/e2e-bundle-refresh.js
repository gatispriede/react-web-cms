// e2e:bundle:refresh — regenerate tests/e2e/fixtures/bundles/cv-latest.json
// from the running dev server's admin Bundle export.
//
// Usage:
//   npm run e2e:bundle:refresh
//
// Assumes:
//   - Dev server running on http://localhost:80 (adjust via E2E_BUNDLE_URL)
//   - An admin user seeded with the env-provided password
//
// The script:
//   1. Signs in via NextAuth credentials
//   2. Calls the admin Bundle export endpoint
//   3. Writes the response body to tests/e2e/fixtures/bundles/cv-latest.json
//
// Sentinel handling — `cv-latest.json` ships with `__stub: true`. The
// smoke spec aborts on the sentinel; regenerating overwrites it with
// the real bundle so the next smoke run uses live content.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const BASE = process.env.E2E_BUNDLE_URL ?? 'http://localhost:80';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@admin.com';
const ADMIN_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD ?? process.env.E2E_BUNDLE_ADMIN_PASSWORD;
const OUTPUT = path.resolve(__dirname, '..', 'tests', 'e2e', 'fixtures', 'bundles', 'cv-latest.json');

if (!ADMIN_PASSWORD) {
    console.error(
        '[e2e:bundle:refresh] ADMIN_DEFAULT_PASSWORD (or E2E_BUNDLE_ADMIN_PASSWORD) must be set ' +
        'so the script can sign in to the admin Bundle export endpoint.',
    );
    process.exit(2);
}

async function main() {
    // Lazy import — keep the script CommonJS-clean and dep-free.
    const url = new URL(BASE);

    // 1. Get a CSRF token from NextAuth (required before credentials POST).
    const csrf = await jsonGet(`${BASE}/api/auth/csrf`);
    if (!csrf?.csrfToken) throw new Error('failed to obtain csrf token');

    // 2. Sign in via the admin-credentials provider.
    const signInRes = await formPost(`${BASE}/api/auth/callback/admin-credentials`, {
        csrfToken: csrf.csrfToken,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        callbackUrl: BASE,
    });
    if (signInRes.statusCode !== 200 && signInRes.statusCode !== 302) {
        throw new Error(`signin failed: HTTP ${signInRes.statusCode}`);
    }
    const cookies = collectCookies(signInRes.headers);
    if (!cookies.length) throw new Error('signin returned no session cookie');

    // 3. Fetch the bundle export (endpoint name is conventional — adjust
    //    when the Bundle module exposes a stable URL).
    const bundle = await jsonGet(`${BASE}/api/export`, {Cookie: cookies.join('; ')});
    if (!bundle || typeof bundle !== 'object') {
        throw new Error('bundle export returned non-object');
    }
    if (bundle.__stub) {
        throw new Error('bundle export still returned the stub — admin has no real content');
    }

    // 4. Write to disk.
    fs.mkdirSync(path.dirname(OUTPUT), {recursive: true});
    fs.writeFileSync(OUTPUT, JSON.stringify(bundle, null, 2) + '\n');
    console.log(`[e2e:bundle:refresh] wrote ${OUTPUT} (${fs.statSync(OUTPUT).size} bytes)`);
}

function jsonGet(urlStr, headers) {
    return new Promise((resolve, reject) => {
        const req = http.get(urlStr, {headers}, (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : null);
                } catch (err) {
                    reject(err);
                }
            });
        });
        req.on('error', reject);
    });
}

function formPost(urlStr, params) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const body = new URLSearchParams(params).toString();
        const req = http.request(
            {
                method: 'POST',
                hostname: u.hostname,
                port: u.port || 80,
                path: u.pathname + u.search,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let chunks = '';
                res.on('data', (c) => (chunks += c));
                res.on('end', () => resolve({statusCode: res.statusCode ?? 0, headers: res.headers, body: chunks}));
            },
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function collectCookies(headers) {
    const raw = headers['set-cookie'] ?? [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((c) => String(c).split(';')[0]).filter(Boolean);
}

main().catch((err) => {
    console.error('[e2e:bundle:refresh] failed:', err.message ?? err);
    process.exit(1);
});
