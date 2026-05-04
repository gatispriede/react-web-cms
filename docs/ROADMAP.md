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

- [F6 — site-mode toggle: scroll vs multipage](roadmap/site-mode-toggle.md) — `siteFlags.siteMode` switch so sites can render as single-page-scroll (legacy/portfolio sites) or multipage-routed (F1, multi-section operations). Skyclimber.pro is scroll-era authored; bundle import + multipage forced incorrect rendering. **M** (1-2 days). 3 open questions in spec.
- [F7 — slug single source of truth](roadmap/slug-source-of-truth.md) — one canonical `normalizeSlug` helper consumed by every site (server + SSR + client active-tab matcher + admin picker + footer + sitemap). Plus pass `pageId` from `[...slug].tsx` → `app.tsx` so the client never re-derives which page is active. Skyclimber's empty-page bug ("Jaunumi un aktualitātes ") was caused by three separate slug normalisers doing slightly different things. **S** (2-4 hr). User feedback: "either way we always should see on client side what we see on admin side, it's unacceptable to not match."
- **F8 — MCP coverage to real-world-ready** — shipped 2026-05-04. Registry grew **38 → 87 tools** across 14 surfaces. W1 hardening primitives (`compose(...)` with rate-limit → idempotency → error-envelope, drift CI 0/0). W2 P0+P1 (page lifecycle, users, permissions, languages, site content, trash). W3 P2 (themes/images/orders/diagnostics/discovery) + 10-step agent runbook ([runbooks/mcp-onboarding-walkthrough.md](runbooks/mcp-onboarding-walkthrough.md)) + end-to-end CI spec. 24 destructive tools idempotent + mode-gated. Drift CI exits 0 hard / 0 soft. **Pending follow-ups:** streaming transport for bundle/image ops, plugin SDK for third-party tools, E2E un-skip post Windows-fanout fix. See [roadmap/mcp-real-world-ready.md](roadmap/mcp-real-world-ready.md).
- **Bundle-import → markRestartRequired() hook** — when imported bundle's language symbol set differs from current `next-i18next.config.js` locales, set the existing restart banner. Avoids the locale-stale errors seen on skyclimber import. **S** (1-2 hr).
- **Visual baseline capture** — `--workers=1` run failed with 1ms instant errors per spec; needs spec-load diagnosis (separate from `--workers` setup).
- **2 lingering `test.skip`s** — Trash restore-flow (Popconfirm OK button needs a stable testid) + idempotency reusable-button (no non-destructive guarded button candidate exists). Low priority.

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
- **Tests:** **693/693 green** across 110 files (was 644 pre-blitz; +49 new tests across F1/F2/F5/sub-pages/cascade/idempotency/guarded-action/Diagnostics/per-locale-slugs/tolerant-slug-match)
- **Roadmap items:** F1 / F2 / F4 / F5 all shipped (F4 SCSS sweep closed at **0 violations across 37 audited files**, stylelint at error severity); F3 cancelled (see [v1-url-namespace.md](roadmap/v1-url-namespace.md) postmortem); runbooks for upgrade-droplets + upgrade-smoke-checklist + scss-audit-2026-05-03 + scss-scoping
- **E-commerce flows:** 7 previously-skipped E2E tests un-skipped (cart qty/remove, sub-page cycle/depth/descendant-disabled, trash delete→trash, idempotency guarded confirm); Inventory inline-stock-edit table shipped (VM4-compliant, reuses ProductApi.save with OCC); 2 `test.skip`s linger (low priority — see Forward work)
- **Polish:** Blog folded into MainMenu via `extraItems` prop; dual-logo viewport-toggle; Paper theme reverted to data-driven case; tolerant slug matching wired so legacy URLs (with diacritics + trailing-space artefacts) keep resolving; Footer admin URL field gets LinkTargetPicker by default + free-text toggle for special URLs
- **Visual:** regression baselines scaffold (58 specs)
- **Go-to-market:** onboarding wizard + marketing landing + docs site
- **DX:** conditional gqty regen on prebuild (Q6), AppDockerfile `.git-sha` for blue/green commit verification, mcpAgentTools typecheck cleanup, `ui/client/components/` retired
