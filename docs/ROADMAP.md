# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/). Shipped archive: [`roadmap/shipped.md`](roadmap/shipped.md).

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

- [F4 SCSS sweep](roadmap/scss-scoping.md) — audit shipped (18 violations across 9 files in [scss-audit-2026-05-03.md](roadmap/scss-audit-2026-05-03.md)); stylelint scaffold at warning severity. Sweep remaining — attack patterns in audit doc order: `@media` queries → second-root splits → multi-component admin files. **M** (1-2 days).
- **E-commerce deeper flows** — 5 mount-level specs running; deeper flows still `test.skip()` pending the 5 UI-design gaps in [runbooks/e2e-coverage-matrix.md](runbooks/e2e-coverage-matrix.md): cart row controls, Trash row keying (groups not slugs), sub-page cycle/depth toasts, delete-confirm testid, admin Inventory per-row editor.
- **Visual baseline capture** — Windows worker fanout was blocking. Try Linux CI or `--workers=1` against the Skyclimber + CV bundles as reference state.

---

## What landed recently

See [`roadmap/shipped.md`](roadmap/shipped.md) for the full archive. Headline this week (2026-04-30 → 2026-05-03):

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
- **Tests:** **685/685 green** across 106 files (was 644 pre-blitz; +41 new tests across F1/F2/F5/sub-pages/cascade/idempotency/guarded-action/Diagnostics/per-locale-slugs)
- **Roadmap items:** F1 / F2 / F5 shipped; F3 cancelled (see [v1-url-namespace.md](roadmap/v1-url-namespace.md) postmortem); F4 audit shipped, sweep pending; runbooks for upgrade-droplets + upgrade-smoke-checklist + scss-audit-2026-05-03 + scss-scoping
- **E2E:** e-commerce mount-level specs (5 files) for products/cart/checkout/inventory/orders; deeper flows guarded by `test.skip` pending data-testids
- **Visual:** regression baselines scaffold (58 specs)
- **Go-to-market:** onboarding wizard + marketing landing + docs site
- **DX:** conditional gqty regen on prebuild (Q6), AppDockerfile `.git-sha` for blue/green commit verification, mcpAgentTools typecheck cleanup, `ui/client/components/` retired
