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

### New (2026-05-03)

- **F1 — sub-pages** — shipped 2026-05-03. Full surface: foundation (data model, slug-chain resolver, sitemap, AntD Menu, admin sider nesting, breadcrumb), plumbing (slug chain through `app.tsx`, SSR theme-name on `<body>`, mobile drawer nested rendering, decorative outer `<Tabs>` retired, gqty regen, `parent` on `InNavigation`), mobile-drawer SCSS polish (chevron rotate, child-row indent, dark-mode parity via existing CSS vars), **per-locale slugs** (`slug: string | Record<LocaleCode, string>` via JSON scalar — non-breaking SDL; locale-first → default-locale → slugified-page fallback resolver; sitemap with hreflang alternates; admin per-locale slug editor with bare-string→Record promote button). 51/51 Navigation+slugChain+dialog tests. See [roadmap/sub-pages.md](roadmap/sub-pages.md).
- **F2 — data integrity** — shipped 2026-05-03. Foundation (idempotency engine + cascade engine + `*.trash` + Trash pane), follow-ups (recursive Navigation→Navigation cascade, `useGuardedAction` hook + `GuardedAction` VM class wired into 5 destructive flows), Seo doc-mutating cascade (engine `kind: 'doc-mutate'` discriminator + Seo rule unsetting `SiteSeo.pages.<slug>` on Navigation cascade), Posts→page pinning (`pageId?` on `IPost`, cascade rule, admin Pin Select). See [roadmap/data-integrity.md](roadmap/data-integrity.md).
- **F3 — `/v1/**` namespace migration** — in flight 2026-05-03 (paused on `git mv` permission). Decisions resolved: prefix `/v1/`, redirect window 1 release cycle, `public/` untouched (it's the user's temp-file directory), sharp break is OK, **URL-only — backend `services/` source layout untouched**. Scope: 30 files under `pages/admin/` + 29 under `pages/api/` move to `pages/v1/`; ~200 internal callsites swept (`fetch('/api/')`, `<Link href="/admin/">`); existing `next.config.js` `redirects()` extends with 308 v1 rules; existing `rewrites()` retargets `/v1/api/robots.txt` and `/v1/api/sitemap.xml`; locale-prefix admin redirects retarget `/v1/admin`. Rationale per user: per-route version splits enable mixed-version deployments. See [roadmap/v1-url-namespace.md](roadmap/v1-url-namespace.md).
- [F4 — SCSS scoping audit + sweep](roadmap/scss-scoping.md) — every per-component SCSS file styles only its own component. No bare-element rules escaping a module's root class. Stylelint enforcement + per-file sweep across `ui/client/modules/`, `ui/client/features/`, `ui/admin/features/`. **L** (2-3 days). 3 open questions in the spec.

### Bulk migrations (mechanical)

Empty. AUI-mode simplified components landed for Themes (preset gallery — no token editor) and Posts (title + body + cover, auto-publish) on 2026-05-03. Remaining panes ship a simplified variant on demand when a real UX gap surfaces; the shell's `modes.simplified ?? modes.advanced` fallback covers everything else.

### E2E backlog

| # | Notes |
|---|---|
| 1 | **E-commerce flow tests — wire data-testids + seed fixtures** — 5 spec files exist with mount-level assertions; deeper flows are `test.skip()` pending data-testids on Products/Cart/Checkout/Inventory/Orders components plus `seedProduct`/`seedOrder` fixtures. See top of each `tests/e2e/ecommerce/*.spec.ts` for the TODO list |
| 2 | **Visual baseline image capture** — `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots`, then commit `tests/e2e/visual/__snapshots__/`. Reference: live site at funisimo.pro + `public/CV/site-2026-05-03.json` |
| 3 | **gqty cold-load anti-pattern sweep** — Themes pane fix (`ThemeApi.listThemes` → raw fetch) revealed 5 candidate APIs with the same direct-route empty-payload risk: `SiteFlagsApi.get`, `FooterApi.get`, `SiteSeoApi.get`, `TranslationMetaApi.get`, `AuditApi.getAuditCollections`/`getAuditActors`. Apply same pattern proactively or wait for first failure report |

### Cleanup / debt

Empty. Three items closed 2026-05-03:

- **Admin-segregation Phase 3 deletion** — gated on observation, runbook is the durable handle: [runbooks/admin-segregation-phase3.md](runbooks/admin-segregation-phase3.md). Re-add to this list when the observation window closes with zero `scope: legacy-route` hits.
- **C13b stable-anchor** — closed. Timeline now emits `#${company}-${role}` per entry (Timeline.tsx + anchorRegistry.ts). Manifesto is intentionally section-only (single body paragraph, no row model).
- **C17 field-level sample audit** — closed deferred-on-demand. Broad per-EItemType coverage already exists; re-open if a client surfaces a specific gap.

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
- **F2 data integrity:** idempotency engine (Redis primary + Mongo fallback) boot-wired in `setupClient`; `idempotencyKey: String` on 7 destructive mutations (deletePost, deleteNavigationItem, removeSectionItem, deleteLanguage, deleteTheme, removeUser, revokePermission); cascade engine + `cascadeRules` on FeatureManifest; soft-delete to `*.trash` collections with 24h Mongo TTL; depth-bounded recursive Navigation→Navigation cascade (3-level cap, visited-set cycle safety); `cascadeRestore` + restore mutation; admin Trash pane at `/admin/release/trash`; Permissions cascade rule; `useGuardedAction` hook + `GuardedAction` VM class wired into Posts/Themes/Users/MCP/AdminApp delete flows; 652/652 tests green
- **E2E:** e-commerce mount-level specs (5 files) for products/cart/checkout/inventory/orders; deeper flows guarded by `test.skip` pending data-testids
- **Visual:** regression baselines scaffold (58 specs)
- **Go-to-market:** onboarding wizard + marketing landing + docs site
- **DX:** conditional gqty regen on prebuild (Q6), AppDockerfile `.git-sha` for blue/green commit verification, mcpAgentTools typecheck cleanup, `ui/client/components/` retired
