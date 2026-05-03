# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/).

---

## Shipped 2026-04-30 → 2026-05-02

Platform refactor wave — every spec linked below describes the architecture; the implementation has landed (services + GraphQL surface + admin UI where applicable). Bulk migration follow-ups are tracked in **Pending — bulk migrations** below.

| Spec | What landed |
|---|---|
| [service-modularity](features/platform/service-modularity.md) | Phases A/B/C — every feature owns its manifest. |
| [class-loader](features/platform/class-loader.md) | L1+L2+L3 — 22 ServiceLoader classes. **L4 — all 17 admin panes registry-driven**; legacy switch trimmed to one fallback. |
| [view-model-classes](features/platform/view-model-classes.md) | VM1+VM2 — bare-Proxy `observable.ts` helper. **VM3 — 17/17 panes migrated** (Themes + Translations landed 2026-05-02). **VM4 — flat-config ESLint rule bans `useState` in `ui/admin/features/**`**. |
| [plug-and-play-features](features/platform/plug-and-play-features.md) | v1 + v2 — env > Mongo > default precedence, admin UI, MCP tools. v3 (hot-reload) deferred. |
| [server-restart](features/platform/server-restart.md) | Backend + UI banner + bootId-poll-and-reload, FeatureFlags wiring. |
| [edit-levels](features/platform/edit-levels.md) | Permissions feature + service, functional roles, `guardMethods` resource-gate hook, request-scoped cache. |
| [admin-ui-modes](features/platform/admin-ui-modes.md) | Data model, GraphQL surface, `useAdminMode()` hook, top-bar switcher, mode-aware dispatcher (all 17 panes respect the toggle automatically). |
| [client-analytics](features/platform/client-analytics.md) | AnalyticsService + Loader + ingest + canned summary, client `track()` / auto-pageview, admin dashboard, MCP tool. |
| CustomerAuth split | New top-level feature, plug-and-play toggleable, fail-closed when off. |

**Tests:** 342 unit (48 files) + 75 e2e, 24 features in registry, **17/17 admin panes registry-driven**.

### Architecture skeleton — what every new feature plugs into

A feature added today wires through these primitives — no architectural decisions left to make:

- **Backend**: `<Feature>ServiceLoader extends ServiceLoader` declares services, indexes, SDL, authz, optional `resourceGated` extractors, optional `functionalRoles`. Plug-and-play toggle controlled by env / Mongo / default. Codegen scans `feature.manifest.ts` and feeds the registry.
- **Frontend (admin)**: `<Feature>AdminUILoader extends AdminUILoader` declares `adminPane: {id, route, modes: {simplified?, advanced}}`. Registered in `adminUILoaderRegistry.ts`. Mode-aware dispatch is automatic.
- **Frontend (state)**: `<Feature>ViewModel` extends nothing — plain TS class wrapped by `observable()`. Methods are auto-bound, fields trigger re-renders, `useViewModel(() => new VM())` hooks the component.
- **Authorization**: rank role + functional roles + per-resource grants compose through `guardMethods`. Per-request cache is wired.
- **Operations**: `markRestartRequired()` for boot-bound config changes. Audit hooks via `runMutation`. Health endpoint at `/api/health` with `bootId`.

---

## Queued

### E-commerce wiring

E-commerce specs ([`docs/features/ecommerce/`](features/ecommerce/)) and the supporting UI / services landed 2026-04-29. Real authoring + flow is blocked on **e-commerce real-flow specs (E2E #1)** below; until that lands, `/products`, `/cart`, `/checkout` render empty states and the e-commerce e2e specs are surface-mount only. Wiring order once #1 lands: customer-auth (done) → products → cart → inventory → checkout.

### Pending — bulk migrations

Architecture is settled; these are mechanical follow-ups across many files. Scope per pane is small and well-defined.

1. **VM3 bulk — ✅ COMPLETE (17/17).** Posts, Footer, ErrorLog, McpTokens, Audit, Publishing, Logo, Inquiries, Users, Bundle, Orders, Inventory, Products, Layout, Analytics, **Themes** (style/font picker state moved to `ThemesViewModel`), **Translations** (`TranslationsViewModel` wraps the existing `TranslationManager`). Landed 2026-05-02.
2. **L4 bulk — ✅ COMPLETE.** All 17 admin panes mount through the AdminUILoader registry (`adminUILoaderRegistry.ts`). Legacy `UserStatusBar.renderPane()` trimmed to a single `system/features` fallback (kept inline because FeatureFlagsPanel hosts the restart banner). Mode-aware dispatch picks `modes.simplified ?? modes.advanced` based on `useAdminMode()`.
3. **VM4 — ✅ COMPLETE.** Flat-config ESLint at `eslint.config.mjs`; `no-restricted-imports` rule bans `useState` named import from `react` under `ui/admin/features/**` at error level. All other rules emit warnings during the initial rollout. Probed end-to-end. Landed 2026-05-02.
4. **L4 — public route discovery** — read `ClientUILoader.publicRoutes`, auto-apply `withFeatureGate`, replace per-page wiring in `pages/`.
5. **L4 — item-types migration** — feature-by-feature move from the flat `ui/admin/lib/itemTypes/registry.ts` to `ClientUILoader.itemTypes` + `AdminUILoader.itemTypeEditors` pairs.
6. **edit-levels — per-feature `resourceGated` declarations** — each mutation that should be gated declares its `(args) => {scope, resourceId}` extractor in the manifest. Empty by default; add per pane that wants the gate.
7. **edit-levels — admin UI** — assign roles + grants to users from `/admin/system/users`. Builds on the GraphQL surface already shipped.
8. **edit-levels — i18n migration** — one-shot at boot: when `siteFlags.inlineTranslationEdit` is ON, grant `translator` to every editor-rank user. Then drop the flag.
9. **admin-ui-modes — per-feature simplified components** — each pane that wants a simplified variant ships `<Feature>SimplifiedView.tsx` and registers it as `modes.simplified` on its AdminUILoader. The shell already handles dispatch.
10. **admin-ui-modes — MCP execution gate** — `enforceModeForTool(userId, toolId)` helper at the top of advanced-only MCP tool resolvers; throws `FeatureRestrictedError` when the calling user is in simplified mode.
11. **admin-ui-modes — Things-to-do panel** — shared component used by simplified dashboard + the queued onboarding wizard.
12. **client-analytics — country-code lookup** — bundled GeoLite at deploy time; ingest derives a 2-letter country and discards the IP.

### E2E backlog

Order by leverage:

1. **E-commerce real-flow specs** — schema + resolvers already wired; `ProductApi` calls real fields. Write one happy-path per feature: products (create/edit/publish/view), cart (add/view/remove/clamp), checkout (full machine), inventory (sync + adjust), orders (state machine through one shipment). Edge cases deferred.
2. **gqty schema regeneration** — `npm run generate-schema` against a live server with the updated `services/api/schema.graphql` (now includes `IUser.kind`). Drop the raw-fetch workaround in `services/api/client/UserApi.ts`. Probably also fixes the MCP `mcp-issue` / `mcp-revoke` flow (currently fixme). 2 fixme tests.
3. **Themes direct-route gqty** — `Theme.tsx` at `/admin/client-config/themes` gets empty `mongo.getThemes` from `gqty.resolve` even though raw fetch works. May resolve with #2; if not, needs its own client-init investigation. Reinstates smoke step 7 + `themes.spec.ts`.
4. **Visual regression baselines — broad coverage.** Snapshot every module's Display component AND Editor, plus every feature surface (admin + public). Refactor-safety net. Baselines under `tests/e2e/visual/__snapshots__/`. CI sharding: 4× chromium, nightly on `master`.

### Admin UX — Phase 3 cleanup

5. [features/platform/admin-segregation.md](features/platform/admin-segregation.md) — drop the legacy `/admin/settings` tab strip + retire the `AdminSettings.tsx` shell. Phase 1 (additive routes) and Phase 2 (six-area top bar + jump routes) are shipped; Phase 3 is the legacy-removal sweep after one or two release cycles confirm nothing is bookmarked against the old URLs.

### Production caching

6. [production-caching.md](roadmap/production-caching.md) — Caddy stale-while-revalidate for public pages (~60s TTL) + anon GraphQL (~30s TTL); cache keyed on server `bootId` + per-feature version stamp so admin writes don't serve stale public reads. DataLoader deferred — folded into the ServiceLoader contract (each loader owns its own batched accessors). ISR + on-demand revalidation already shipped 2026-04-30.

### Go-to-market

| Item | Status |
|---|---|
| Onboarding flow — first-run wizard (site name, admin account, theme pick) | Planned |
| Landing page — AI angle, positions against Contentful / Builder.io, pricing | Planned |
| Documentation — setup, feature reference, AI/MCP workflow guide | Planned |

### Production / ops

[`roadmap/production/`](roadmap/production/README.md) — feature/UX and ops scheduled independently.

| Item | Status |
|---|---|
| [Automatic deployment](roadmap/production/automatic-deployment.md) | Planned |
| [Seamless deployment (zero-downtime)](roadmap/production/seamless-deployment.md) | Planned |
| [DigitalOcean domain + TLS wiring](roadmap/production/digitalocean-domain-wiring.md) | Planned |
| [MongoDB auth](roadmap/production/mongodb-auth.md) | Planned |

---

## Debt

All known debt cleared as of 2026-05-01.
