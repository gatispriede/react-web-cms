# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/). Shipped archive: [`roadmap/shipped.md`](roadmap/shipped.md).

---

## Architecture skeleton — what every new feature plugs into

A feature added today wires through these primitives — no architectural decisions left to make:

- **Backend**: `<Feature>ServiceLoader extends ServiceLoader` declares services, indexes, SDL, authz, optional `resourceGated` extractors, optional `functionalRoles`, optional `cacheVersionKeys`, optional `batchAccessors`. Plug-and-play toggle controlled by env / Mongo / default. Codegen scans `feature.manifest.ts` and feeds the registry.
- **Frontend (admin)**: `<Feature>AdminUILoader extends AdminUILoader` declares `adminPane: {id, route, modes: {simplified?, advanced}}`. Registered in `adminUILoaderRegistry.ts`. Mode-aware dispatch is automatic.
- **Frontend (state)**: `<Feature>ViewModel` extends nothing — plain TS class wrapped by `observable()`. Methods are auto-bound, fields trigger re-renders, `useViewModel(() => new VM())` hooks the component. **`useState` is lint-banned in `ui/admin/features/**`.**
- **Authorization**: rank role + functional roles + per-resource grants (feature / page / locale, intersection semantics) compose through `guardMethods`. Per-request cache is wired.
- **Operations**: `markRestartRequired()` for boot-bound config changes. Audit hooks via `runMutation`. Health endpoint at `/api/health` with `bootId`. Cache versions bump automatically when `cacheVersionKeys` are declared.

---

## Open queue

### New (2026-05-03)

- [F1 — sub-pages](roadmap/sub-pages.md) — extend single-level page nav to support nested children. Catch-all routing, parent-id refs, anchor registry walk, breadcrumbs. **L** (1-3 days).

### E-commerce wiring

E-commerce specs ([`docs/features/ecommerce/`](features/ecommerce/)) and the supporting UI / services landed 2026-04-29. Real authoring + flow is blocked on **e-commerce real-flow specs** below; until that lands, `/products`, `/cart`, `/checkout` render empty states. Wiring order once specs land: customer-auth (done) → products → cart → inventory → checkout.

### Bulk migrations

| Item | Notes |
|---|---|
| **VM3 sub-panes** (~10) | Carry explicit `eslint-disable-next-line no-restricted-imports` markers: Agent, Analytics, Bundle helpers, ModulePicker, AddNewLanguageDialog, ImageRail, FeatureFlags, RestartRequiredBanner, SEO, FontPicker. Migrate in any order |
| **L4 — public route discovery** | Read `ClientUILoader.publicRoutes`, auto-apply `withFeatureGate`, drop per-page wiring |
| **L4 — item-types migration** | Move per-feature off the flat `ui/admin/lib/itemTypes/registry.ts` to `ClientUILoader.itemTypes` + `AdminUILoader.itemTypeEditors` pairs |
| **edit-levels — per-feature `resourceGated`** | Each mutation that should be gated declares its `(args) => {feature?, page?, locale?}` extractor. Posts is the reference (Q10). Add per pane that wants the gate |
| **edit-levels — i18n migration** | Boot-once: when `siteFlags.inlineTranslationEdit` is ON, grant `translator` to every editor-rank user. Then drop the flag |
| **admin-ui-modes — per-feature simplified components** | Each pane that wants a cut-down view ships `<Feature>SimplifiedView.tsx` and registers it as `modes.simplified`. Shell already dispatches |
| **admin-ui-modes — MCP execution gate** | `enforceModeForTool(userId, toolId)` helper at the top of advanced-only MCP tool resolvers; throws `FeatureRestrictedError` |
| **admin-ui-modes — Things-to-do panel** | Shared component for the simplified dashboard |
| **client-analytics — country-code lookup** | Bundled GeoLite at deploy time; ingest derives a 2-letter country and discards the IP |

### E2E backlog

| # | Notes |
|---|---|
| 1 | **E-commerce real-flow specs** — happy-path per feature: products / cart / checkout / inventory / orders. Edge cases deferred |
| 2 | **Themes direct-route gqty** — `Theme.tsx` at `/admin/client-config/themes` gets empty `mongo.getThemes` from `gqty.resolve` even though raw fetch works |
| 3 | **Visual regression baseline capture** — `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots`, then commit `tests/e2e/visual/__snapshots__/`. Specs + CI shard config already shipped |

### Cleanup / debt

| Item | Notes |
|---|---|
| **Admin-segregation Phase 3 deletion** | After ≥ 1 release cycle of zero `scope: legacy-route` hits in Errors panel, drop legacy pages + middleware + redirect entries. See [runbook](runbooks/admin-segregation-phase3.md) |
| **AppDockerfile `.git-sha` emission** | Blue/green deploy script's commit-hash check no-ops without `/app/.git-sha`. One-line `RUN` directive |
| **Pre-existing typecheck error** | `services/agent/mcpAgentTools.ts` — `inputSchema: unknown` vs typed shape. Unrelated to recent work but remains noise in `tsc` output |

### Tests

[`roadmap/tests-remaining.md`](roadmap/tests-remaining.md) — LoginBtn / section snapshots / API integration tests still queued (MongoApi facade + conflict + googleFonts already shipped).

---

## What landed recently

See [`roadmap/shipped.md`](roadmap/shipped.md) for the full archive. Headline this week (2026-04-30 → 2026-05-03):

- Production caching (C9), image-ref + link-ref schema convergence (C18), visual regression baselines (Q4), ESLint flat config + VM4 lint rule (Q1)
- Three-dimension grants (Q10), seamless deployment (P4), MongoDB auth + DO domain + auto-deploy (Q8)
- Onboarding wizard + marketing landing + docs site (Q7)
- Admin shell: dark-mode + simplified-mode hoisted to top-top bar, click-to-edit on modules in simplified, favicon
- `ui/client/components/` removed — Marketing + Cart moved to `ui/client/features/`
