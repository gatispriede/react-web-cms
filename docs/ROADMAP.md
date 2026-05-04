# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/). Shipped archive: [`roadmap/shipped.md`](roadmap/shipped.md).

---

## Status (2026-05-04, late)

- **Master HEAD:** `2c7be30` — F7 slug source-of-truth, F8 MCP coverage, email config, admin nav reorg, admin click-parent (option B), themed 404/500, e2e prod-mode smoke, Hero portrait dimension inputs, mode-aware click handling.
- **🚨 Prod hotfix on develop, awaiting merge:** `0390491` pins `--webpack` on every `next build` invocation in `package.json`. Next 16 defaults `next build` to Turbopack and rejects the existing `webpack:` block in `ui/client/next.config.js` — production deploy on funisimo.pro / skyclimber.pro failed health checks. Once merged to master, `deploy.yml` redeploys both droplets.
- **Develop is 8 commits ahead of master** (1 prod-blocker + 4 admin polish + 2 CI hygiene + 1 roadmap update). See [roadmap/README.md](roadmap/README.md#current-status-2026-05-04-late) for the per-commit list.

---

## Architecture skeleton — what every new feature plugs into

A feature added today wires through these primitives — no architectural decisions left to make:

- **Backend**: `<Feature>ServiceLoader extends ServiceLoader` declares services, indexes, SDL, authz, optional `resourceGated` extractors, optional `functionalRoles`, optional `cacheVersionKeys`, optional `batchAccessors`. Plug-and-play toggle controlled by env / Mongo / default. Codegen scans `feature.manifest.ts` and feeds the registry.
- **Frontend (admin)**: `<Feature>AdminUILoader extends AdminUILoader` declares `adminPane: {id, route, modes: {simplified?, advanced}}` + optional `itemTypeEditors`. Registered in `adminUILoaderRegistry.ts`. Mode-aware dispatch is automatic.
- **Frontend (client)**: `<Feature>ClientUILoader` declares `publicRoutes` (auto-applies `withFeatureGate` via `gatePath`) + optional `itemTypes` (Display half of the module registry).
- **Frontend (state)**: `<Feature>ViewModel` extends nothing — plain TS class wrapped by `observable()`. Methods auto-bind, fields trigger re-renders, `useViewModel(() => new VM())` hooks the component. **`useState` is lint-banned in `ui/admin/features/**` (VM4 rule). 17/17 panes migrated.**
- **Authorization**: rank role + functional roles + per-resource grants (feature / page / locale, intersection semantics) compose through `guardMethods`. Per-request cache is wired. **30 admin mutations grant-gated** across Posts / Products / Inventory / Orders / Footer / Themes / Languages / Bundle / Navigation / Seo / Permissions / Users.
- **Operations**: `markRestartRequired()` for boot-bound config changes. Audit hooks via `runMutation`. Health endpoint at `/api/health` with `bootId`. Cache versions bump automatically when `cacheVersionKeys` are declared. Blue/green deploy supported (gated by `vars.SEAMLESS_DEPLOY`).
- **MCP**: tools that mutate or affect site state are gated as advanced-only via `enforceModeForTool(userId, toolId)`; throws `FeatureRestrictedError` for simplified-mode users.

---

## Open queue

### Pre-merge verification

Two prod sites need a 1:1 sanity pass before master merges. Bundles exported 2026-05-03:

| Domain | Bundle | Verify against |
|---|---|---|
| **funisimo.pro** | [`public/CV/site-2026-05-03.json`](../public/CV/site-2026-05-03.json) (51 MB) | live site at funisimo.pro |
| **skyclimber** | [`public/Skyclimber/site-2026-05-03.json`](../public/Skyclimber/site-2026-05-03.json) (68 MB) | live skyclimber domain |

Import bundle into local build → open public client → walk every page side-by-side with the live domain. Content + visual must match 1:1. Any drift is a regression to fix before merge. Runbook: [runbooks/upgrade-droplets.md](runbooks/upgrade-droplets.md). Smoke checklist: [runbooks/upgrade-smoke-checklist.md](runbooks/upgrade-smoke-checklist.md).

### Forward work

- [F6 — site-mode toggle: scroll vs multipage](roadmap/site-mode-toggle.md) — `siteFlags.siteMode` switch so sites can render as single-page-scroll (legacy/portfolio sites) or multipage-routed (F1, multi-section operations). Skyclimber.pro is scroll-era authored; bundle import + multipage forced incorrect rendering. **M** (1-2 days). Phased plan now in [roadmap/README.md](roadmap/README.md): (1) unify scroll/multipage shell incl. mobile menu — also fixes the visible styling drift the operator flagged 2026-05-04; (2) `SiteFooter` mode prop with hash-anchor rewrite; (3) proper enum `siteMode` flag + admin Select; (4) routing branch in `getStaticProps`. Phase 1 is the highest-impact slice.
- **Mobile column behavior** — per-module flag governing what happens to multi-column sections on narrow viewports. Three values envisaged: `stack` (current default — every section collapses to 100% rows in DOM order), `keep-ratio` (rare — keep 50/50 horizontally, content has to fit), `reorder-N` (stack but flip which side comes first). Filed by client feedback 2026-05-04; no spec doc yet, design + spec when picked up. **S**.
- **Section + module drag-reorder root cause** — drag-reorder for both section and per-module rows stopped firing at some point. The 2026-05-04 commits `cc306a7` + `a12c7b6` ship explicit up/down + label arrow buttons as the immediate fix; the underlying drag flow (`getChangedPos` + `DraggableWrapper`) needs an actual diagnosis. **M**.
- **Deploy auto-rollback on health-check fail** — the default (non-seamless) deploy path runs `docker compose up --no-deps --build -d app` which atomically recreates the `front` container. If the new image fails to boot (as it did with the `--webpack` hotfix on 2026-05-04), the old container is gone and the public site is down until the next deploy lands. Either tag `app:current` before rebuild and restore on health-check failure, or promote `SEAMLESS_DEPLOY=1` (P4 blue/green) to default — that path already keeps both slots alive and only flips Caddy on success. **S**.
- **Bundle-import → markRestartRequired() hook** — when imported bundle's language symbol set differs from current `next-i18next.config.js` locales, set the existing restart banner. Avoids the locale-stale errors seen on skyclimber import. **S** (1-2 hr).
- **Visual baseline capture** — `--workers=1` run failed with 1ms instant errors per spec; needs spec-load diagnosis (separate from `--workers` setup).
- **F8 — MCP coverage** — shipped 2026-05-04. **Pending follow-ups:** streaming transport for bundle/image ops, plugin SDK for third-party tools, E2E un-skip post Windows-fanout fix. See [roadmap/mcp-real-world-ready.md](roadmap/mcp-real-world-ready.md).
- **2 lingering `test.skip`s** — Trash restore-flow (Popconfirm OK button needs a stable testid) + idempotency reusable-button (no non-destructive guarded button candidate exists). Low priority.

---

## What landed recently

See [`roadmap/shipped.md`](roadmap/shipped.md) for the full archive.

### 2026-05-04 — F7 + UX polish + dev-loop hardening

- **F7 slug source of truth** — canonical `normalizeSlugForMatch` in `shared/utils/slug.ts`, re-exported by server and client modules. `pageId` threaded `[...slug].tsx` → `app.tsx`; `findIdForActiveTab` rewritten to exact id-based lookup. Three `menuPages` projections in `app.tsx` rekeyed off `p.id` so sub-pages nest under the right root. 17 new tests; 790 total green. Commits `0d9de06` + `f510beb`.
- **email config** — SMTP / Resend / Disabled providers behind a `mailConfig` site-flag, AES-GCM encryption via `SECRETBOX_KEY`. Admin pane at System → Email with provider switcher, test-send button, per-provider validation, specific missing-fields error surfacing. 4 commits including a sanitizer-encrypt fix (`5cf5cd8`) and missing-fields surfacing (`1fb8ebb`).
- **Admin click-parent edit (option B)** — sider parent-row title click navigates/edits like any leaf; explicit chevron button toggles expand/collapse via controlled `openKeys[]`. Tree flattened manually so AntD SubMenu can't intercept clicks. Commit `bad78a9`.
- **Themed error pages** — `404.tsx` + new `500.tsx` + new `_error.tsx` share a `<ErrorScreen/>` component that pulls `--background` / `--ink` / `--accent` / `--font-display` / `--theme-borderRadius` from the active theme; leads with `<Logo/>` so the brand mark mirrors the favicon. Commit `8711f37`.
- **e2e prod-mode smoke** — workflow switched from `next dev` per worker to `next build` once + `next start` per worker, eliminating the dev-mode flake surface (Turbopack-vs-webpack churn, drawer-DOM detachment from rebuilds). Smoke spec rewrite — 5 active tests (bundle import, public render, Hero portrait dims, translation flip, publish), no `scrollIntoViewIfNeeded` calls anywhere, native DOM clicks where Playwright's auto-scroll stability wait flaked. Steps removed from smoke per design call: 4 (footer race), 7 (theme switch), 10 (blog post draft). `mongodb-memory-server` binary pre-warmed in CI to avoid parallel-download race. Commit `2c7be30`.
- **Hero portrait dimension inputs** — width/height number inputs added to HeroEditor's Portrait tab, bind to `portraitImage.width` / `portraitImage.height` on the existing IImageRef shape (no schema change). Testids `module-editor-hero-portrait-{width,height}-input`. Same commit as smoke.
- **Admin nav reorg** — System area-nav (users → email → inquiries → flags → rest); SEO becomes its own area; Errors → System; Bundle first in Release. Commits `1c4dece` + `10d0f03`.
- **roadmap tidy** — moved F7/F8/email-config/admin-nav/click-parent/themed-errors/mcp-call helper into `roadmap/shipped.md`; dropped F1/EL-feat-rest/tests-remaining from the open queue (already shipped 2026-05-03). Commit `fab0eb6`.

### 2026-05-04 (late) — develop-only, awaiting master merge

- **🚨 Prod hotfix `0390491`** — `--webpack` flag on every `next build` invocation in `package.json`. Critical: production deploys are failing without this.
- **Mode switcher hard-reload** — `AdminModeSwitcher` reloads the page after a successful flip so per-loader `modes` dispatch picks up the new variants. Commit `3959851`.
- **Unified inline action strip** — `[label] [edit] [up] [down] [delete]` rendered as one container per row at both section and module levels; section strip top-right with 32px buttons, module strip top-left with 24px buttons. Replaces three separate floating clusters that used to overlap each other. Section-level reorder calls back to the existing `getChangedPos` path. Commits `cc306a7` + `576b212` + `a12c7b6`.
- **Visual regression CI noise fix** — drop master-push trigger from the visual job until baselines are committed (Q4-cap). Commit `9373e02`.
- **Smoke spec native click on bundle-import confirm** — same auto-scroll stability flake we hit on per-module edit; native DOM `.click()` via `evaluate`. Commit `43409e7`.

### 2026-04-30 → 2026-05-03 — F1/F2/F4/F5 blitz

- **Production:** caching (C9 — bootId + per-feature versions + Caddy SWR + DataLoader), Mongo auth (P5), DO domain wiring (P3), automatic deploy (P2), seamless blue/green (P4)
- **Auth:** Q10 three-dimension grants + **30 admin mutations gated** across every editable surface (Posts / Products / Inventory / Orders / Footer / Themes / Languages / Bundle / Navigation / Seo / Permissions / Users), i18n grant migration on boot — EL-feat-rest closed
- **Admin platform:** ESLint flat config + VM4 lint rule, **VM3 17/17** complete, L4 public route discovery + composed item-type registry, MCP execution gate (8 advanced-only tools), Things-to-do panel
- **Client platform:** image-ref + link-ref schema convergence (C18), stable anchor emission (C13 + **C13b Timeline per-entry**), image dimensions (C12), client-analytics country lookup with IP discard (CA-geo)
- **Admin shell:** dark-mode + simplified-mode hoisted to top-top bar with chrome-only SCSS scoping, click-to-edit on modules in simplified, favicon, grants UI uses constrained Selects (no free-text), top-bar split (nav actions left / language+chrome right), **AUI simplified panes for Themes (preset gallery) + Posts (title/body/cover, auto-publish)**
- **Tests:** API integration suite (`/api/setup`, `/api/export`+`/api/import` round-trip, `/api/rescan-images`) — 9 tests via mongodb-memory-server. LoginBtn + 6 section snapshots already in green build. tests-remaining.md retired
- **Bundle import:** filename sanitizer accepts spaces, parens, unicode (collapsed to `_`); rejects only on null byte, control char, `..`, disallowed extension
- **Bug fixes:** Themes direct-route gqty cold-load empty payload (raw fetch fallback in `ThemeApi.listThemes`); Products manifest test deep-equal on arrow-function identity
- **F1 sub-pages:** `parent`/`slug` on `IPage`+`INavigation`, `setParent` mutation with cycle/depth-cap server validation, slug backfill on save, `findPageBySlugChain` resolver, parent-scoped slug uniqueness, `[...slug].tsx` catch-all with full slug-chain prop, locale-aware sitemap, AntD `<Menu mode="horizontal">` with `SubMenu` + 4-theme SCSS overrides, anchor registry walks parent chain, admin sider nested rendering, Add-page Parent Select with client cycle guard, Breadcrumb component, delete-with-children prompt, mobile drawer nested rendering, SSR theme-name on `<body>`, decorative outer `<Tabs>` retired, gqty client regenerated with `parent`/`slug`/`setParent`, `parent` round-trips through `InNavigation` (no admin-side workaround)
- **F2 data integrity:** idempotency engine (Redis primary + Mongo fallback) boot-wired in `setupClient`; `idempotencyKey: String` on 7 destructive mutations; cascade engine + `cascadeRules` on FeatureManifest with `kind` discriminator (collection-move + doc-mutate); soft-delete to `*.trash` collections with 24h Mongo TTL; depth-bounded recursive Navigation→Navigation cascade; `cascadeRestore` + restore mutation; admin Trash pane at `/admin/release/trash`; cascade rules for Permissions / Seo / Posts; `useGuardedAction` hook + `GuardedAction` VM class wired into 5 destructive flows
- **F5 admin diagnostics:** `Diagnostics` feature + admin pane at `/admin/system/info` (7 sections: build identity, route registry HEAD-probes, feature manifest summary, storage health, trash overview, idempotency snapshot, authorization snapshot); public `/api/info` endpoint exposing only `{version, bootId, buildTimestamp}` (env-secret audited); `IdempotencyService.stats()` (counts only)
- **Tests:** **693/693 green** across 110 files (was 644 pre-blitz; +49 new tests across F1/F2/F5/sub-pages/cascade/idempotency/guarded-action/Diagnostics/per-locale-slugs/tolerant-slug-match)
- **Roadmap items:** F1 / F2 / F4 / F5 all shipped (F4 SCSS sweep closed at **0 violations across 37 audited files**, stylelint at error severity); F3 cancelled (see [v1-url-namespace.md](roadmap/v1-url-namespace.md) postmortem); runbooks for upgrade-droplets + upgrade-smoke-checklist + scss-audit-2026-05-03 + scss-scoping
- **E-commerce flows:** 7 previously-skipped E2E tests un-skipped (cart qty/remove, sub-page cycle/depth/descendant-disabled, trash delete→trash, idempotency guarded confirm); Inventory inline-stock-edit table shipped (VM4-compliant, reuses ProductApi.save with OCC); 2 `test.skip`s linger (low priority — see Forward work)
- **Polish:** Blog folded into MainMenu via `extraItems` prop; dual-logo viewport-toggle; Paper theme reverted to data-driven case; tolerant slug matching wired so legacy URLs (with diacritics + trailing-space artefacts) keep resolving; Footer admin URL field gets LinkTargetPicker by default + free-text toggle for special URLs
- **Visual:** regression baselines scaffold (58 specs)
- **Go-to-market:** onboarding wizard + marketing landing + docs site
- **DX:** conditional gqty regen on prebuild (Q6), AppDockerfile `.git-sha` for blue/green commit verification, mcpAgentTools typecheck cleanup, `ui/client/components/` retired
