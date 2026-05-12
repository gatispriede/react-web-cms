---
name: performance-budget-ci
description: Lighthouse + Core Web Vitals + page-weight + bundle-size CI gates. Sibling of accessibility-wcag22-audit (a11y) — same e2e harness, same per-theme × per-mode matrix, but for performance budgets.
research: see _meta/research-findings-2026-05-12.md §4 (mobile-first baseline, 375 px) + §3 (mobile car shopping — 70-75% mobile traffic).
---

# Performance budget CI gate

## Goal

Lock in performance budgets pre-public-deploy:

- **Lighthouse perf score ≥ 85** on the 5 highest-traffic public routes × every shipped theme × both modes
- **Core Web Vitals** under thresholds: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
- **Initial JS payload ≤ 200kb gzipped** per route
- **Initial HTML response ≤ 50kb** uncompressed
- **Image rendering** — every `<img>` carries `width` + `height` + `loading="lazy"` (except above-the-fold)
- **Font loading** — no FOIT; `font-display: swap` everywhere; subsetted woff2

Pair with [accessibility-wcag22-audit.md](../storefront/accessibility-wcag22-audit.md) — same Playwright harness, same matrix, sibling concern.

## Why now

- Mobile is 70-75% of car-shopping traffic (research finding). Bad perf on 4G mobile = lost conversions.
- LCP impact on rankings: Google's `Interaction to Next Paint` metric replaced FID in 2024; missing INP < 200ms drops crawl ranking.
- ss.com listing pages will be heavy (15-20+ photos). Without budgets, gallery + lazy-load discipline drifts.
- Easier to enforce from day 1 than retrofit after launch.

## Design

### Targets per route type

| Route type | LCP | INP | CLS | JS gzipped | HTML | Lighthouse perf |
|---|---|---|---|---|---|---|
| Home / generic page | 2.0s | 150ms | 0.05 | 150kb | 30kb | 90 |
| Blog post | 2.0s | 150ms | 0.05 | 150kb | 40kb | 90 |
| Product / car list | 2.5s | 200ms | 0.10 | 200kb | 50kb | 85 |
| Product / car detail | 2.5s | 200ms | 0.10 | 200kb | 50kb | 85 |
| Checkout / account | 2.0s | 150ms | 0.05 | 200kb | 40kb | 85 |

All targets measured on **mobile 4G throttle** (Lighthouse default — 1.6Mbps down / 750Kbps up / 150ms RTT).

### Tooling

- **Lighthouse CI** (`@lhci/cli`) — runs Lighthouse against URLs, asserts against budgets, posts results to a Lighthouse CI server (self-hosted or temporary GitHub artifact)
- **Playwright + `playwright-lighthouse`** — alternative for integrating into existing e2e suite
- **`size-limit`** — for bundle-size gates per route; runs against the Next build output
- **`vercel/og` Lighthouse audit** — for the OG image generator routes

Choice: **Lighthouse CI in `.github/workflows/perf-audit.yml`** (separate workflow, not blocking PR by default; weekly scheduled run + PR-comment with deltas).

Plus `size-limit` integrated into the main CI for bundle-size gating (PR-blocking).

### Per-theme variance

Each theme shipped from [first-class-themes.md](../storefront/first-class-themes.md) measured independently — agency theme's hero animation might bring LCP up, editorial theme's heavy serif font might bring CLS up. Per-theme budgets where the platform-wide target doesn't fit; documented in the theme's `README.md`.

### Image discipline (enforced by ESLint rule)

```ts
// Already aspirational in target-architecture.md; lint-enforce here.
// All <img> require width + height; <Image> from next/image preferred.
// Exception: decorative images with role="presentation"
```

`next/image` is the default; raw `<img>` flagged unless inside `node_modules` or marked decorative.

### Font discipline

- **All custom fonts subsetted** to the active language set (woff2, ~10-30kb per face)
- **`font-display: swap`** mandatory on every `@font-face`
- **Preconnect to font CDN** (`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`)
- **Variable fonts where available** (1 file × 1 axis × 1 weight range instead of 4 files per weight)

Theme-specific fonts pulled via the existing google-fonts feature; subsetted on build.

### Bundle-size budget per route

`size-limit` config:

```json
{
  "size-limit": [
    {"path": ".next/static/chunks/pages/index-*.js",        "limit": "60 KB"},
    {"path": ".next/static/chunks/pages/blog/[slug]-*.js",  "limit": "70 KB"},
    {"path": ".next/static/chunks/pages/cars/index-*.js",   "limit": "90 KB"},
    {"path": ".next/static/chunks/pages/cars/[slug]-*.js",  "limit": "100 KB"},
    {"path": ".next/static/chunks/pages/checkout-*.js",     "limit": "80 KB"},
    {"path": ".next/static/chunks/framework-*.js",          "limit": "50 KB"}
  ]
}
```

Fails CI on breach. Includes the framework + per-route chunks; doesn't double-count shared deps.

### Real-user monitoring

Post-launch RUM via a simple `web-vitals` listener writing to `Analytics`:

```ts
// ui/client/lib/perf/webVitalsReporter.ts
import {onCLS, onINP, onLCP, onFCP, onTTFB} from 'web-vitals';

for (const m of [onCLS, onINP, onLCP, onFCP, onTTFB]) {
    m((metric) => {
        if (!shouldSample(0.1)) return; // 10% sample rate
        fetch('/api/perf', {method: 'POST', body: JSON.stringify({metric, url: location.pathname, theme: getActiveTheme()})});
    });
}
```

Admin dashboard at `/admin/system/performance` shows p50 / p75 / p95 per metric per route per theme. Alerting when p75 LCP > 2.5s for 24h.

### Lighthouse CI workflow

```yaml
# .github/workflows/perf-audit.yml
name: perf-audit
on:
  schedule: [{cron: '0 2 * * MON'}]   # weekly Monday 02:00 UTC
  pull_request:
    paths: ['ui/**', 'next.config.js', 'package.json']

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm run start &
      - run: npx wait-on http://localhost:3000
      - run: npx @lhci/cli@latest autorun
        env:
          LHCI_BUILD_CONTEXT__CURRENT_HASH: ${{ github.sha }}
```

`lighthouserc.json` config defines routes × themes matrix.

### Reporting on the SEO + a11y dashboard

Existing `/admin/system/performance` dashboard (new) shows:

- Last Lighthouse run (CI artifact link) per route × theme
- 30d trend per Core Web Vital per route
- Top regressions (vital that worsened > 10% week-over-week)
- Per-page deep-dive: opportunities / diagnostics from the last Lighthouse run

## Files to touch

- `package.json` — add `@lhci/cli`, `size-limit`, `web-vitals`
- `lighthouserc.json` (new) — routes × themes matrix + budget definitions
- `.size-limit.json` (new) — per-route bundle-size budgets
- `.github/workflows/perf-audit.yml` (new)
- `.github/workflows/ci.yml` (extend) — add `size-limit` step (PR-blocking)
- `ui/client/lib/perf/webVitalsReporter.ts` (new)
- `ui/client/pages/_app.tsx` (extend) — wire web-vitals reporter
- `ui/client/pages/api/perf.ts` (new — receives RUM beacons)
- `services/features/Performance/PerformanceService.ts` (new — aggregates `web-vitals` events from Analytics)
- `services/features/Performance/PerformanceServiceLoader.ts` (new)
- `ui/admin/features/Performance/Performance.tsx` (new — dashboard)
- `ui/admin/features/Performance/PerformanceAdminUILoader.ts` (new)
- `eslint.config.mjs` — rule: ban raw `<img>` without width+height (warn → error transition window)
- `services/features/Mcp/tools/performance.ts` (new — `performance_runAudit`, `performance_metrics_query`, `performance_setBudget`)
- Per-theme: `ACCESSIBILITY.md` siblings get a `PERFORMANCE.md` with theme-specific notes
- Tests: web-vitals reporter sampling, performance service aggregation, budget breach detection

## Starter code

Lighthouse CI config (`lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/cars",
        "http://localhost:3000/cars/2018-audi-a4-sedan-r1234",
        "http://localhost:3000/checkout",
        "http://localhost:3000/blog/welcome"
      ],
      "settings": {
        "preset": "desktop",
        "emulatedFormFactor": "mobile",
        "throttling": {
          "rttMs": 150,
          "throughputKbps": 1638.4,
          "cpuSlowdownMultiplier": 4
        }
      },
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "categories:accessibility": ["error", {"minScore": 0.90}],
        "categories:best-practices": ["warn", {"minScore": 0.90}],
        "categories:seo": ["error", {"minScore": 0.90}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "interaction-to-next-paint": ["error", {"maxNumericValue": 200}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-byte-weight": ["error", {"maxNumericValue": 1500000}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

## Acceptance

1. `lighthouserc.json` defines routes × themes matrix + budgets per route type
2. Weekly scheduled `perf-audit.yml` runs against all routes × themes; comments PR with delta on relevant changes
3. `size-limit` step in main CI gates PR-blocking; bundle-size regressions caught at PR time
4. `web-vitals` RUM beacons fire from 10% of public visitors; aggregated in admin dashboard
5. Each first-class theme passes its budget; documented per-theme deviation (e.g. agency theme allowed 100 LCP allowance for cinematic transition) lives in the theme's `PERFORMANCE.md`
6. ESLint rule blocks raw `<img>` without width+height (warn-only initially → error after 2 weeks)
7. Admin dashboard at `/admin/system/performance` shows live + historical perf per route × theme
8. MCP coverage: `performance_*` tools

## Effort

**M · ~3h AI.**

- Lighthouse CI workflow + lighthouserc config: ~30 min
- size-limit integration: ~15 min
- web-vitals reporter + RUM beacon endpoint: ~45 min
- Performance service aggregation + admin dashboard: ~1h
- ESLint rule + lint-fix sweep on existing `<img>` violations: ~30 min

## Dependencies

- [first-class-themes.md](../storefront/first-class-themes.md) — themes shipped to audit
- [accessibility-wcag22-audit.md](../storefront/accessibility-wcag22-audit.md) — shares the Playwright harness
- Q4-cap visual baselines (Wave 0a) — gates this since perf relies on the same e2e infra

## Open questions

- **[OPERATOR DECISION]** Mobile-first emulation in Lighthouse CI — `mobile` only (recommended) or both `mobile` + `desktop`? Recommend: mobile-only on PR-time; both on scheduled weekly run.
- **[OPERATOR DECISION]** RUM sample rate — 10% (recommended) or higher? Higher = more accurate p75; less storage cost on 10%. Recommend: 10%.

## Out of scope

- Synthetic monitoring beyond weekly (e.g. every-15-min uptime checks) — separate item; use UptimeRobot / Pingdom externally
- Page-speed insights integration with Google PSI API — `@lhci/cli` covers this locally
- Continuous chaos / load testing — out of scope until traffic justifies
- Per-region performance audits (Lighthouse run from different geographies) — defer until multi-region deployment
