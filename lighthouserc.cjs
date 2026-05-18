/**
 * Lighthouse CI config — W8d performance budget gate.
 *
 * Runs against a locally-booted `npm run start` (port 3000) and asserts
 * Core Web Vitals + the perf/seo/a11y category scores. Mobile preset
 * mirrors what Google's CrUX measures so PR-time regressions match
 * field-data regressions.
 *
 * `temporary-public-storage` uploads each run's HTML report to Lighthouse
 * CI's hosted bucket — link surfaces in the GitHub Actions log as
 * `https://storage.googleapis.com/lighthouse-infrastructure.../lhr-...html`.
 * No auth required.
 *
 * Route list: the five highest-traffic public routes per
 * `docs/roadmap/platform/performance-budget-ci.md` § "Targets per route
 * type". Per-route thresholds aren't broken out here (LHCI doesn't
 * support per-URL assertions cleanly) — see `.size-limit.cjs` for the
 * per-route bundle gates which DO vary by route.
 */
module.exports = {
    ci: {
        collect: {
            url: [
                'http://localhost:3000/',
                'http://localhost:3000/products',
                'http://localhost:3000/blog',
                'http://localhost:3000/checkout',
                'http://localhost:3000/cart',
            ],
            settings: {
                preset: 'desktop',
                emulatedFormFactor: 'mobile',
                throttling: {
                    rttMs: 150,
                    throughputKbps: 1638.4,
                    cpuSlowdownMultiplier: 4,
                },
                skipAudits: ['uses-http2'],
            },
            numberOfRuns: 1,
            startServerCommand: 'npm run start',
            startServerReadyPattern: 'started server on',
            startServerReadyTimeout: 60000,
        },
        assert: {
            assertions: {
                'categories:performance':       ['warn',  {minScore: 0.85}],
                // W8a — WCAG 2.2 AA gate. Raised from 0.90 to 0.95; spec
                // calls for `≥95 on the 5 highest-traffic routes` and the
                // operator decision recorded in §"Open questions" of the
                // spec ("Lighthouse target — 95 (recommend)") confirms 95.
                'categories:accessibility':     ['error', {minScore: 0.95}],
                'categories:best-practices':    ['warn',  {minScore: 0.90}],
                'categories:seo':               ['warn',  {minScore: 0.90}],
                'largest-contentful-paint':     ['warn',  {maxNumericValue: 2500}],
                'cumulative-layout-shift':      ['error', {maxNumericValue: 0.10}],
                'total-blocking-time':          ['warn',  {maxNumericValue: 300}],
                'total-byte-weight':            ['warn',  {maxNumericValue: 1500000}],
            },
        },
        upload: {
            target: 'temporary-public-storage',
        },
    },
};
