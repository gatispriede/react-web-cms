import {defineConfig, devices} from '@playwright/test';

// DECISION: spec layout is top-level `tests/e2e/` (not co-located) per spec §3
// — keeps a separate tsconfig away from ui/client's strict next-build rules
// and gives a single place to grep coverage from.
//
// DECISION: no `webServer` block. Each Playwright worker spawns its own
// `next dev` against its own mongodb-memory-server (see tests/e2e/fixtures).
// `baseURL` is therefore set per-test by the `serverUrl` fixture, not here.
//
// DECISION: chromium only. Cross-browser is explicitly out of scope per
// spec §13 until a real user issue surfaces.
export default defineConfig({
    testDir: 'tests/e2e',
    // Only `.spec.ts` files are Playwright tests. The `.test.ts` files
    // under `tests/e2e/fixtures/` (e.g. moduleSamples.test.ts) are
    // Vitest unit tests for the fixtures themselves; if Playwright tries
    // to load them it crashes with "Vitest cannot be imported in a
    // CommonJS module" because they `import {describe, it, expect} from
    // 'vitest'`.
    testMatch: '**/*.spec.ts',
    // Per-test timeout. Tests do real navigation against a real dev server,
    // and the *first* navigation triggers Next's per-route Turbopack compile
    // (10–40 s on Windows for routes that import the admin shell). 90 s gives
    // headroom for the slowest legitimate test without masking real hangs.
    timeout: 90_000,
    expect: {timeout: 10_000},
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    // When reusing an externally-spawned dev server (the default `e2e` /
    // `e2e:headed` scripts set PLAYWRIGHT_E2E_REUSE_DEV=1), all workers
    // share one server + one Mongo, so they have to serialise on data.
    // The isolated mode (`e2e:isolated*`) spawns a dedicated server +
    // memory-Mongo per worker and can parallelise.
    workers: process.env.PLAYWRIGHT_E2E_REUSE_DEV
        ? 1
        : (process.env.CI ? 4 : 2),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['html'], ['github']] : 'list',
    use: {
        // baseURL is overridden per test by the `serverUrl` fixture in
        // tests/e2e/fixtures/server.ts — every worker has its own port.
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        // Default action timeout — once the dev server is warm, every
        // click / fill / hover is sub-second. 5 s catches real hangs
        // without sitting on flake. Long-running operations (bundle
        // import, asset upload) override locally with explicit
        // `{timeout: ...}` on the relevant `expect()` or call.
        actionTimeout: 5_000,
        navigationTimeout: 10_000,
    },
    projects: [
        {
            name: 'chromium',
            use: {...devices['Desktop Chrome']},
        },
    ],
});
