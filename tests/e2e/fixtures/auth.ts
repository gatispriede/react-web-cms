import {test as base, BrowserContext, Page, expect} from '@playwright/test';
import {startMongo, E2EMongoHandle} from './db';
import {startServer, E2EServerHandle} from './server';
import {seedAdmin, SeededAdmin} from './seedFactories';

// Playwright test fixtures shared by the whole e2e suite.
//
// DECISION: worker-scoped everything that can be — Mongo, server, admin
// user, AND the signed-in session. Per-test sign-in was the dominant
// per-test cost (300–800 ms × N tests adds up); now we sign in ONCE per
// worker, capture the NextAuth cookie via `context.storageState()`, and
// every `adminPage` opens with that storage state pre-injected. Tests
// stay independent because each one still spins up its OWN browser
// context — the cookie is the only state copied across, identity is
// otherwise fresh.
//
// Per-test slug namespacing (`buildScenario` in the module harness)
// keeps data-level isolation: each spec authors its own pages/sections
// so concurrent tests within a worker can't collide on the same row.

export interface E2EWorkerFixtures {
    mongo: E2EMongoHandle;
    server: E2EServerHandle;
    serverUrl: string;
    sharedAdmin: SeededAdmin;
    /** NextAuth-cookie storage state, captured once per worker. */
    adminStorageState: any;
}

export interface E2ETestFixtures {
    seededAdmin: SeededAdmin;
    adminPage: Page;
    customerPage: Page;
    anonPage: Page;
}

export const test = base.extend<E2ETestFixtures, E2EWorkerFixtures>({
    mongo: [async ({}, use, workerInfo) => {
        const handle = await startMongo(workerInfo.workerIndex);
        await use(handle);
        await handle.stop();
    }, {scope: 'worker', timeout: 240_000}],

    server: [async ({mongo}, use, workerInfo) => {
        // 240 s setup budget: `next dev` cold-compile on Windows can take
        // 60–180 s the first time, and the worker can't proceed until the
        // server answers. Without this, the default per-fixture timeout
        // (60 s, inherited from `timeout`) fires before compile finishes
        // and every test in the worker fails with "Fixture timeout
        // exceeded during setup."
        const handle = await startServer({mongoUri: mongo.uri, workerIndex: workerInfo.workerIndex});
        await use(handle);
        await handle.stop();
    }, {scope: 'worker', timeout: 240_000}],

    serverUrl: [async ({server}, use) => {
        await use(server.url);
    }, {scope: 'worker'}],

    // The default `baseURL` in playwright.config.ts is undefined; override it
    // per-test so `page.goto('/admin')` resolves against the worker's port.
    baseURL: [async ({serverUrl}, use) => {
        await use(serverUrl);
    }, {scope: 'test'}],

    /** Shared admin row — one Users insert per worker, reused across all tests. */
    sharedAdmin: [async ({mongo}, use) => {
        const admin = await seedAdmin(mongo.uri);
        await use(admin);
        await admin.cleanup();
    }, {scope: 'worker'}],

    /**
     * Sign in once per worker through the real `/auth/signin` form, then
     * capture the resulting storage state (cookies + localStorage) so
     * every per-test `adminPage` skips the form entirely. The throwaway
     * context is closed immediately after capture — only the serialized
     * storageState object travels into per-test contexts.
     */
    adminStorageState: [async ({browser, serverUrl, sharedAdmin}, use) => {
        // Pre-warm `/admin/signin` BEFORE opening the browser context. The
        // first-ever request to a route triggers Next dev's per-route
        // Turbopack/webpack compile, which on Windows cold dev can take
        // 60–180 s for the auth bundle (NextAuth + AntD form). A bare
        // `page.goto('/admin/signin')` inside `signInThroughForm` blew
        // past the previous 60 s fixture timeout, leaving the worker
        // dead before the form ever rendered. A plain `fetch` here lets
        // Next finish the compile cheaply (no browser actionability
        // clock running) so the subsequent navigation is warm.
        // 240 s matches the `server` fixture's compile budget; same
        // failure mode, same envelope.
        await prewarmRoute(`${serverUrl}/admin/signin`, 240_000);
        const ctx = await browser.newContext({baseURL: serverUrl});
        const page = await ctx.newPage();
        await signInThroughForm(page, sharedAdmin.email, sharedAdmin.password);
        const state = await ctx.storageState();
        await ctx.close();
        await use(state);
    }, {scope: 'worker', timeout: 240_000}],

    /**
     * Backwards-compat alias — older specs request `seededAdmin` to assert
     * lockout / wrong-password flows that need a clean per-test bucket.
     * For the common "I just need an admin session" path, prefer
     * `adminPage` (worker-scoped, no per-test signin cost).
     */
    seededAdmin: async ({sharedAdmin}, use) => {
        await use(sharedAdmin);
    },

    adminPage: async ({browser, serverUrl, adminStorageState}, use) => {
        const ctx: BrowserContext = await browser.newContext({baseURL: serverUrl, storageState: adminStorageState});
        const page = await ctx.newPage();
        attachHydrationFilter(page);
        await use(page);
        await ctx.close();
    },

    customerPage: async ({browser, mongo, serverUrl}, use) => {
        // Customer fixture is wired but unused in Phase 1 specs — Phase 2
        // (cart/checkout) will exercise it. Keeping the wire-up here so the
        // shape doesn't change later.
        const ctx: BrowserContext = await browser.newContext({baseURL: serverUrl});
        const page = await ctx.newPage();
        attachHydrationFilter(page);
        await use(page);
        await ctx.close();
    },

    anonPage: async ({browser, serverUrl}, use) => {
        const ctx: BrowserContext = await browser.newContext({baseURL: serverUrl});
        const page = await ctx.newPage();
        attachHydrationFilter(page);
        await use(page);
        await ctx.close();
    },
});

export {expect} from '@playwright/test';

/**
 * Suppress Next.js hydration / React render warnings so Playwright doesn't
 * trip on the dev-mode error overlay (which intercepts clicks). Hydration
 * mismatches in dev are noisy but rarely block a real flow — they're
 * worth surfacing in the unit suite, not the e2e one.
 */
function attachHydrationFilter(page: Page): void {
    // Pre-seed the cookie-consent record so the public banner never mounts
    // during e2e. Without this, the banner intercepts pointer events on
    // the first navigation of every fresh context (admin or anonymous),
    // and every click in the underlying page retries until timeout.
    // Mirrors the schema in ui/client/components/CookieConsent/consentStore.ts.
    void page.addInitScript(() => {
        try {
            const STORAGE_KEY = 'cms.privacy.consent.v1';
            const record = {
                version: 1,
                categories: {necessary: true, functional: false, analytics: false, marketing: false},
                source: 'user',
                recordedAt: new Date().toISOString(),
            };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        } catch {/* localStorage not available — banner will fall back to its default */}
    });

    const HYDRATION_PATTERNS = [
        /Hydration failed/i,
        /Text content does not match/i,
        /server-rendered HTML didn['']?t match/i,
        /Warning: An error occurred during hydration/i,
        /Minified React error #(418|419|421|422|423|424|425)/,
    ];
    page.on('pageerror', (err) => {
        const msg = err?.message ?? '';
        if (HYDRATION_PATTERNS.some((p) => p.test(msg))) return;
         
        console.warn('[e2e] page error:', msg);
    });
    // Hide Next dev's floating widgets, error overlay, and toast portals
    // entirely. `pointer-events: none` isn't enough — Playwright's
    // actionability checks still see them as intercepting elements.
    // `display: none` removes them from the layout tree completely.
    // The underlying page is intact; failure screenshots still show
    // whatever real UI was on screen.
    void page.addInitScript(() => {
        // Only target Next's own custom elements / build-watcher. Avoid
        // `[data-nextjs-*]` selectors — those can collide with AntD's
        // modal / dialog DOM in dev mode where it inherits Next's
        // styling shims, and hiding them breaks real admin flows.
        const css = `
            nextjs-portal,
            #__next-build-watcher {
                display: none !important;
            }
        `;
        const inject = () => {
            if (document.head && !document.head.querySelector('[data-e2e-overlay-disable]')) {
                const style = document.createElement('style');
                style.dataset.e2eOverlayDisable = 'true';
                style.textContent = css;
                document.head.appendChild(style);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inject, {once: true});
        } else {
            inject();
        }
        // Re-inject on SPA route changes (Next pages-router replaces head children).
        const observer = new MutationObserver(inject);
        observer.observe(document.documentElement, {childList: true, subtree: true});
    });
}

async function signInThroughForm(page: Page, email: string, password: string): Promise<void> {
    // Phase 1.A auth-split: admin auth has its own NextAuth instance under
    // `/api/admin/auth/*` + signin page at `/admin/signin`. The legacy
    // `/auth/signin` route serves the CUSTOMER instance now; admin
    // credentials are rejected there.
    // Generous nav timeout: even with the route pre-warmed via fetch, the
    // browser-side hydration + AntD bundle eval can still take 15–30 s on
    // a Windows cold worker. 60 s gives headroom without masking real hangs.
    await page.goto('/admin/signin', {timeout: 60_000});
    await page.getByTestId('admin-signin-email-input').fill(email);
    await page.getByTestId('admin-signin-password-input').fill(password);
    await page.getByTestId('admin-signin-submit-btn').click();
    // The admin shell lives under `/admin`. Wait for any non-signin URL —
    // the post-login redirect target may evolve. Post-submit the browser
    // navigates to `/admin` which can also cold-compile on the first hit;
    // 90 s covers the worst-case Windows cold case while still failing
    // fast on a genuinely broken signin.
    await expect(page).not.toHaveURL(/\/admin\/signin/, {timeout: 90_000});
}

/**
 * Hit a route via plain fetch so Next dev's per-route compile happens
 * before any browser actionability budget starts. Tolerates the route
 * returning any HTTP status — we only care that the bundle finished
 * compiling and the runtime answered.
 */
async function prewarmRoute(url: string, timeoutMs: number): Promise<void> {
    const started = Date.now();
    let lastErr: unknown;
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url, {redirect: 'manual'});
            if (res.status > 0) return;
        } catch (err) {
            lastErr = err;
        }
        await new Promise(r => setTimeout(r, 750));
    }
    throw new Error(`prewarm ${url} did not respond within ${timeoutMs}ms: ${String(lastErr)}`);
}
