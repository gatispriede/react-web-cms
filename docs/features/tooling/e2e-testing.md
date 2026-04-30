# End-to-end testing — Headless browser per module / feature

Status: Draft / planned
Last updated: 2026-04-29
Related: docs/architecture/overview.md, vitest.config.ts (existing unit/integration test setup)

## 1. Overview

A second tier of automated tests that drives a real Chromium browser against a running Next.js dev server and verifies user-visible behaviour for every module and every feature. Vitest + `mongodb-memory-server` continues to cover service-layer logic; this layer covers the rest:

- The admin shell loads, login works, and edits round-trip to the public site.
- Every section module type renders, in every declared style, on the public site.
- Every feature surface (themes, i18n, publishing, products, cart, checkout, customer auth, etc.) has a happy-path test plus the obvious error paths.
- Visual regressions are flagged via screenshot diffs on a curated set of pages.

## 2. Tooling decision — Playwright

**Choice: [Playwright](https://playwright.dev) (Microsoft, open source).** Selenium-equivalent capability, but:

- First-class TypeScript API, fits the rest of the repo.
- Built-in test runner (`@playwright/test`) with parallelisation, retries, fixtures, traces — no separate Mocha/Jest harness.
- `chromium`, `firefox`, `webkit` drivers shipped together; we'll run Chromium only in CI for speed.
- Screenshot + video + trace artifacts on failure are the default.
- `expect(page).toHave*` auto-waits, eliminating most flakes that plagued Selenium projects.

Alternatives considered and rejected:
- **Selenium / WebDriverIO** — older API, more boilerplate, weaker auto-waiting story.
- **Cypress** — same-origin-only, can't drive cross-origin OAuth (Google sign-in for customer auth would be painful).
- **Puppeteer** — no test runner of its own; we'd reinvent fixtures and parallelism.

## 3. Layout

```
tests/e2e/
├── playwright.config.ts          # one config, projects = browsers
├── fixtures/
│   ├── db.ts                     # boots a fresh mongodb-memory-server per worker
│   ├── server.ts                 # spawns `next dev` against the test DB
│   ├── seedFactories.ts          # makeUser, makeProduct, makeSection, ...
│   └── auth.ts                   # signed-in admin / signed-in customer / anon contexts
├── modules/                      # one spec per EItemType
│   ├── hero.spec.ts
│   ├── timeline.spec.ts
│   ├── ...
│   └── projectCard.spec.ts
├── features/                     # one spec per docs/features/*.md
│   ├── content-management.spec.ts
│   ├── theming.spec.ts
│   ├── publishing.spec.ts
│   ├── i18n.spec.ts
│   ├── blog.spec.ts
│   ├── auth-admin.spec.ts
│   ├── auth-customer.spec.ts     # added with customer-auth module
│   ├── products.spec.ts          # added with Products module
│   ├── cart.spec.ts              # added with Cart module
│   ├── checkout.spec.ts          # added with Checkout module
│   ├── inventory.spec.ts         # added with Inventory module
│   └── mcp.spec.ts               # admin token issuance UI (server-side MCP itself unit-tested)
├── visual/                       # screenshot diffs on stable pages
│   ├── home.spec.ts
│   ├── modules-preview.spec.ts   # leverages /admin/modules-preview
│   └── theme-presets.spec.ts
└── utils/
    ├── interactWithModule.ts     # shared helpers for opening edit modals etc.
    └── routes.ts                 # central URL builders so route changes don't fan out
```

Specs follow the existing `docs/features/*.md` naming so coverage is auditable: a missing spec file means a missing feature test.

## 4. Server + DB lifecycle

Each Playwright **worker** (parallel browser instance) gets:

1. Its own `mongodb-memory-server` instance (port-allocated).
2. Its own `next dev` process pointed at that DB via `MONGODB_URI` env override.
3. A shared upload directory under `tmp/e2e/<workerId>/uploads`.
4. Fresh seed via `seedFactories.ts` per spec or per `beforeEach` (configurable).

Cost: each worker boots ~5 s. With `workers: 4` on a typical CI runner, full suite cold-starts in ~20 s overhead, then runs tests in parallel. Hot-reload is disabled in test mode (`NEXT_DISABLE_HMR=1`) so navigation doesn't trip on a recompile.

For local dev there's also `npm run e2e:dev` which reuses the developer's already-running `next dev` and Mongo, useful for iterating on a single spec.

## 5. Coverage targets

Spec coverage is tracked in `tests/e2e/COVERAGE.md`, generated from a script that:
- Lists every `EItemType` × declared style and asserts a matching test exists in `tests/e2e/modules/`.
- Lists every file in `docs/features/` and asserts a matching spec in `tests/e2e/features/`.
- CI fails if either list has gaps.

Each module spec must cover:
1. **Render in admin edit modal** — opens, all required fields present, save works.
2. **Render on public site** — published section appears with the expected content.
3. **Each style** — switching style in the admin renders the right markup on public.
4. **Empty-content guardrail** — no broken `<img>` / placeholder leaks.

Each feature spec must cover the **happy path** plus the most common error path documented in that feature's `docs/features/*.md`.

## 6. Visual regression

`tests/e2e/visual/*.spec.ts` uses Playwright's `expect(page).toHaveScreenshot()` against committed baselines under `tests/e2e/visual/__screenshots__/`.

- Limited to a curated handful of pages (home, `/admin/modules-preview` for every module × style, each theme preset). Not every test takes screenshots — that becomes maintenance noise.
- Tolerance: 1% pixel diff, matching Playwright's default. Updates require a deliberate `npm run e2e:update-screenshots` and a baseline-update commit.
- Baselines are PNG; they live in git (small, stable). Failure artifacts (`.diff.png`) are uploaded to CI artifacts on failure.

## 7. Auth fixtures

`tests/e2e/fixtures/auth.ts` exposes Playwright fixtures:

```ts
export const test = base.extend<{
  adminPage: Page;     // signed in as the seeded admin
  editorPage: Page;    // signed in as 'editor' role
  customerPage: Page;  // signed in as a customer (post customer-auth module)
  anonPage: Page;      // fresh context, no cookies
}>({ ... });
```

Implementation calls NextAuth's credential endpoint directly via `request` (no UI navigation), then writes the session cookie into the browser context. Saves seconds per test vs. driving `/auth/signin` every time.

## 8. CI

GitHub Actions workflow `.github/workflows/e2e.yml` runs on every PR:

- `services: mongo` — none, we use mongodb-memory-server in-process.
- Steps: `npm ci`, `npx playwright install --with-deps chromium`, `npm run e2e`.
- Artifacts uploaded on failure: `playwright-report/`, `test-results/` (videos + traces + screenshots).
- Sharding: `playwright test --shard=$i/$N` across 4 jobs; each shard runs ~25% of the suite.

The existing `ci.yml` (typecheck + unit tests) stays as-is. E2E is a separate workflow so unit-test feedback isn't blocked by browser boot time.

## 9. Test data seeding

`fixtures/seedFactories.ts` provides typed factories:

```ts
export async function seedSection(db: Db, overrides?: Partial<ISection>): Promise<ISection> { ... }
export async function seedTheme(db: Db, overrides?: Partial<ITheme>): Promise<ITheme> { ... }
export async function seedAdmin(db: Db, overrides?: Partial<IUser>): Promise<IUser> { ... }
export async function seedProduct(db: Db, overrides?: Partial<IProduct>): Promise<IProduct> { ... }
```

Factories use the same service classes (`SectionService.save`, `ThemeService.save`, …) so seeded data goes through the same validation / version stamping as production code — no hand-written Mongo docs.

## 10. Flake budget & retries

- Specs are written to be deterministic — `expect(...).toBe*` with auto-wait, no manual `setTimeout`s.
- CI retries: `retries: process.env.CI ? 2 : 0`. A spec retried >0 times in main CI auto-files an issue (separate workflow `flake-tracker.yml`) so we don't normalise flake.
- Trace mode `on-first-retry` keeps storage cheap but captures everything when a retry happens.

## 11. Performance budget

- Full suite target: **<6 min on CI** with 4-shard parallelism.
- Per-spec target: **<10 s wall-clock**. Specs longer than 30 s require justification in a comment.
- Module-render tests hit the public page directly via `goto`, not by clicking through the admin every time.

## 10a. Timing budget

Once the dev server is warm, every UI interaction is sub-second. Default Playwright `use.actionTimeout` is **5 s** — catches genuine hangs without sitting on flake. Carve-outs (set per-call with `{timeout: ...}`):

- Bundle import (50+ MB JSON, embedded base64 images) → 180 s
- Bundle export (download stream) → 60 s
- Asset upload / download → 30 s
- First-load navigations on cold-compiled routes → 10 s (set as `navigationTimeout`)

Any other operation that needs more than 5 s is suspicious — flag in code review.

## 10b. Hydration / React error handling

Next dev mode renders a full-screen error overlay on hydration mismatches; that overlay intercepts Playwright clicks. The auth fixture (`tests/e2e/fixtures/auth.ts`) installs a `pageerror` filter that swallows the standard hydration-warning patterns and best-effort dismisses the overlay if it appears. The unit suite (`vitest`) catches real hydration regressions; the e2e suite ignores them so a single hydration warning doesn't cascade into a chain failure.

If a spec needs to assert on a hydration error specifically, override the filter inside that test by adding its own `pageerror` listener.

## 11a. Two scenario classes — smoke and full

Two parallel suites, each with a different cost / coverage trade-off.

### Smoke (`tests/e2e/smoke/`)

**Goal:** "if this passes, the build is healthy enough to push." Single Chromium worker, single chain test, ~30–90 s wall-clock. Runs as a `pre-push` hook and on every PR.

**Composition:** one `test.describe.serial` chain that a real maintainer would do in their first ten minutes after a deploy. The chain:

1. **Sign in** as the seeded admin (real form, real session cookie).
2. **Import the latest CV bundle** via the admin Bundle UI — picks up the canonical fixture at `tests/e2e/fixtures/bundles/cv-latest.json` (regenerated from the live site by `npm run e2e:bundle:refresh`). This seats a known content state so the rest of the chain has real data to edit.
3. **Edit the 5 most-complex modules** (Hero, Timeline, Gallery, Services, ProjectGrid by field-count) — change one canonical text marker on each. Verify each marker reaches the public render.
4. **Change a translation** — open the side-by-side translation editor, flip one key in a non-default locale, save. Verify the public locale page reflects the change.
5. **Change the footer** — open Footer settings, edit the copyright text, save. Verify the public site footer.
6. **Upload a picture** — drag-drop a fixture file (`tests/e2e/fixtures/files/sample-portrait.jpg`) through the Assets picker. Verify the asset appears in the picker grid.
7. **Swap the Hero portrait image + dimensions** — open the Hero on the seeded page, change `portraitImage` to the just-uploaded asset, set `portraitWidth` and `portraitHeight` to non-default values, save. Verify the public render uses the new src and respects the dimensions.
8. **Switch language** — toggle the public-site language to a non-default locale via the admin language switcher (or by hitting `/<locale>` directly). Verify a translation-overlay-driven module renders in the new locale.
9. **Add a simple blog post** — Posts pane → New post → title/body → publish. Verify the post appears at `/<locale>/blog/<slug>` and on the blog feed module if one is on the home page.

**Cleanup:** the per-test `seededAdmin.cleanup()` removes the admin row. The bundle import is *not* cleaned up — every smoke run starts fresh from the canonical CV bundle, so the ending state is overwritten on the next run regardless. This keeps cleanup deterministic without trying to undo nine consecutive UI operations.

**Why this exact set:** these are the surfaces that historically break first — a translation key drift, a Bundle-schema mismatch, an Asset-upload regression, an i18n switch that loses the cookie. Hitting all of them in one chain is a higher-signal smoke than nine individual atomic tests.

**Run:**

```bash
npm run e2e:smoke
# under the hood: playwright test --project=chromium tests/e2e/smoke/
```

Pre-push hook (`.husky/pre-push` or equivalent): runs `npm run e2e:smoke` against the developer's local dev server. Bails early on the first failure with the playwright trace artefact for the failed step.

### Full (`tests/e2e/features/`, `tests/e2e/modules/`, `tests/e2e/visual/`)

**Goal:** complete coverage. Runs nightly on `develop` and on merge to `main`. Includes:

- Per-`EItemType` × style module specs (the `admin-modules-chain.spec.ts` foundation extended).
- Per-feature specs (auth-admin, auth-customer, products, cart, checkout, inventory, mcp, etc. — one spec per `docs/features/` entry).
- Visual regression baselines.

**Composition:** parallel workers, sharded 4×, ~5–10 min wall-clock total.

**Run:**

```bash
npm run e2e          # everything
npm run e2e -- --project=chromium tests/e2e/features/  # just feature specs
```

### Smoke vs Full at a glance

| | Smoke | Full |
|---|---|---|
| Scope | One chain, ~9 actions | All specs, all modules |
| Workers | 1 | 4 (sharded in CI) |
| Wall-clock | 30–90 s | 5–10 min |
| Trigger | pre-push, every PR | nightly, merge to main |
| Failure cost | Blocks push | Blocks merge |
| Bundle | Imports `cv-latest.json` fresh | Each spec seeds its own state |

## 12. Rollout plan

Phase 1 (with the e2e infra PR):
- Playwright config + fixtures + seed factories
- 3 representative spec files: `auth-admin.spec.ts`, `content-management.spec.ts`, `theming.spec.ts`
- CI workflow

Phase 2 (one PR per module):
- One module spec at a time, smallest first (PlainText, Image)
- Module-coverage gate enabled in CI once all 17 module specs land

Phase 3 (e-commerce specs):
- Land alongside each new feature: `products.spec.ts` ships with the Products module, etc.
- Customer-auth and checkout get full multi-step specs covering decline / out-of-stock / merge-cart paths

Phase 4 (visual regression):
- Add the `visual/` directory after the rest of the suite is stable

## 11b. MCP integration

E2E is a first-class part of the [CMS AI Bridge](mcp-server.md) tool surface — AI clients (Claude Code, Cursor) can trigger and read e2e runs without leaving the session. This is the loop that closes "AI made a change → AI verified the change is healthy".

### Tools (CLI form, MCP-wrapped)

| CLI command | MCP tool | Scope | Purpose |
|---|---|---|---|
| `cms e2e list` | `e2e.list` | `read:e2e` | Enumerate available scenarios + spec files |
| `cms e2e smoke` | `e2e.smoke` | `write:e2e` | Run the smoke chain (§11a). Returns structured summary |
| `cms e2e run <spec>` | `e2e.run` | `write:e2e` | Run a specific spec or pattern |
| `cms e2e status` | `e2e.status` | `read:e2e` | Last-run summary (passed / failed / skipped / duration) |
| `cms e2e failures` | `e2e.failures` | `read:e2e` | Failures from the last run, with trace + screenshot paths |
| `cms e2e bundle:refresh` | `e2e.bundle.refresh` | `write:e2e` | Regenerate `cv-latest.json` from current admin state |

Two new scopes on the [scoped-token model](mcp-server.md): `read:e2e` (status / failures / list — safe, read-only) and `write:e2e` (actually runs Playwright). A token issued for "verify my changes" gets `write:e2e`; a CI dashboard token gets `read:e2e` only.

### Why this loop matters

Without MCP-driven e2e, an AI client that uses the other CMS tools to make changes has no way to verify those changes survive the canonical user flow short of asking the human to run tests. With it:

1. AI calls `page.create` / `section.add` / `theme.set` to make changes.
2. AI calls `e2e.smoke` to verify the build still passes.
3. On failure, AI calls `e2e.failures` to read trace paths, fetches the trace, debugs, fixes, and re-runs.

The smoke scenario specifically mirrors what a human reviewer does in the first ten minutes after pulling — it's the fastest signal that things compose.

### Failure shape

`e2e.smoke` and `e2e.run` return structured JSON on failure (full schema in [`mcp-server.md`](mcp-server.md) under the "E2E (Playwright)" command list). Trace artefact paths are relative to repo root; AI clients with filesystem MCP can fetch them directly, otherwise they surface for the human.

### Audit

Every `e2e.smoke` / `e2e.run` / `e2e.bundle.refresh` invocation writes an audit row tagged `actor: 'mcp:<token-name>'`, same as every other tool call. So the answer to "who triggered the test run that just generated 200MB of trace artefacts" is one `audit.list` query away.

## 13. Out of scope (v1)

- Cross-browser matrix (Firefox, WebKit) — Chromium only until there's a reported user issue.
- Mobile-viewport tests — use `page.setViewportSize` ad-hoc when relevant; no separate mobile project for now.
- Production-environment smoke tests against the deployed droplet — that's a separate ops concern.
- Load / soak testing.
- Accessibility audits — Playwright has `@axe-core/playwright` available; could be added later as a separate spec set.

## 14. Open questions

1. **Where do specs live** — top-level `tests/e2e/` (proposed) or co-located under each module? Proposal favours discoverability + separate tsconfig for browser globals.
2. **Run on every PR or nightly?** PR gate adds ~6 min. Could split: smoke (5 specs) on every PR, full suite on merge to develop. Decide based on CI minute budget.
3. **Visual diff storage** — keep PNG baselines in git, or push to an external service (Percy, Chromatic)? In-git is free and works for the current size; revisit if baselines grow >20 MB.
4. **Customer-auth Google sign-in test** — Google's OAuth doesn't have a test mode. Either mock the provider in test (proposal) or skip the Google path in e2e and unit-test the callback alone.
5. **Mock vs real payment in checkout spec** — spec uses `MockPaymentProvider` everywhere; when Stripe lands, do we add a separate Stripe-test-mode spec set, or rely on Stripe's own integration tests?
6. **Test data isolation** — per-worker DB (proposed) vs. namespaced collections in a shared DB. Per-worker is simpler and pays for itself in clarity.
7. **Headed mode for local debugging** — `npm run e2e:headed` is trivial to add; should the default be headless or headed when run locally?

---

## Implementation status

Status as of 2026-04-29: **Phase 1 shipped on `develop`** (uncommitted).

Phase 1 complete:
- `playwright.config.ts` at repo root, chromium-only, sharded 4× in CI.
- `tests/e2e/{tsconfig.json,README.md}` + fixtures (`db.ts` per-worker `mongodb-memory-server`, `server.ts` per-worker `next dev`, `seedFactories.ts` direct-Mongo seeders, `auth.ts` Playwright `test.extend` with `adminPage`/`customerPage`/`anonPage`/`resetData`).
- 3 representative specs: `features/auth-admin.spec.ts`, `features/content-management.spec.ts`, `features/theming.spec.ts`.
- `.github/workflows/e2e.yml` — PR-gate, sharded, artifacts on failure.
- `package.json` scripts: `e2e`, `e2e:headed`, `e2e:dev`, `e2e:update-screenshots`, `e2e:install`. Dep: `@playwright/test@^1.55.0`.

Deferred (queued under Phases 2–4):
- Phase 2 — per-`EItemType` × style specs under `tests/e2e/modules/`.
- Phase 3 — e-commerce specs (customer-auth, products, cart, checkout, inventory).
- Phase 4 — visual regression.
- Coverage gate (`COVERAGE.md` autogen + CI fail on missing specs) — wires up when Phase 2 lands.

Operator first-run: `npm install` → `npm run e2e:install` → `npm run e2e`.
