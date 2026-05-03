# Roadmap — redis-node-js-cloud CMS

Forward-looking only. Architecture: [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) + the UML at [architecture/data-model.svg](architecture/data-model.svg). Per-item plans + estimates: [`roadmap/`](roadmap/). Shipped archive: [`roadmap/shipped.md`](roadmap/shipped.md).

---

## Architecture skeleton — what every new feature plugs into

A feature added today wires through these primitives — no architectural decisions left to make:

- **Backend**: `<Feature>ServiceLoader extends ServiceLoader` declares services, indexes, SDL, authz, optional `resourceGated` extractors, optional `functionalRoles`, optional `cacheVersionKeys`, optional `batchAccessors`. Plug-and-play toggle controlled by env / Mongo / default. Codegen scans `feature.manifest.ts` and feeds the registry.
- **Frontend (admin)**: `<Feature>AdminUILoader extends AdminUILoader` declares `adminPane: {id, route, modes: {simplified?, advanced}}` + optional `itemTypeEditors`. Registered in `adminUILoaderRegistry.ts`. Mode-aware dispatch is automatic.
- **Frontend (client)**: `<Feature>ClientUILoader` declares `publicRoutes` (auto-applies `withFeatureGate` via `gatePath`) + optional `itemTypes` (Display half of the module registry).
- **Frontend (state)**: `<Feature>ViewModel` extends nothing — plain TS class wrapped by `observable()`. Methods auto-bind, fields trigger re-renders, `useViewModel(() => new VM())` hooks the component. **`useState` is lint-banned in `ui/admin/features/**` (VM4 rule). 17/17 panes migrated.**
- **Authorization**: rank role + functional roles + per-resource grants (feature / page / locale, intersection semantics) compose through `guardMethods`. Per-request cache is wired. **18 admin mutations grant-gated** across Posts / Products / Inventory / Orders / Footer / Themes / Languages / Bundle.
- **Operations**: `markRestartRequired()` for boot-bound config changes. Audit hooks via `runMutation`. Health endpoint at `/api/health` with `bootId`. Cache versions bump automatically when `cacheVersionKeys` are declared. Blue/green deploy supported (gated by `vars.SEAMLESS_DEPLOY`).
- **MCP**: tools that mutate or affect site state are gated as advanced-only via `enforceModeForTool(userId, toolId)`; throws `FeatureRestrictedError` for simplified-mode users.

---

## Open queue

### New (2026-05-03)

- [F1 — sub-pages](roadmap/sub-pages.md) — extend single-level page nav to support nested children. Catch-all routing, parent-id refs, anchor registry walk, breadcrumbs. **L** (1-3 days). 5 design questions in the spec.

### Bulk migrations (mechanical)

| Item | Notes |
|---|---|
| **AUI-mode — per-feature simplified components** | Shell already dispatches `modes.simplified ?? modes.advanced`. Each pane that wants a cut-down view ships `<Feature>SimplifiedView.tsx`. No pane has one registered yet — needs design per pane (which controls to keep / hide) |
| **EL-feat-rest** | `resourceGated` opt-in for the remaining surfaces: Sections / Navigation / Seo / Permissions / Users / Audit. Pattern is settled; per-loader S |

### E2E backlog

| # | Notes |
|---|---|
| 1 | **E-commerce real-flow specs** — happy-path per feature: products / cart / checkout / inventory / orders. Unblocks the e-commerce wiring queue |
| 2 | **Themes direct-route gqty** — `Theme.tsx` at `/admin/client-config/themes` gets empty `mongo.getThemes` from `gqty.resolve` even though raw fetch works |
| 3 | **Visual baseline image capture** — `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots`, then commit `tests/e2e/visual/__snapshots__/` |
| 4 | **gqty schema regen** — manual run for dev iteration (Q6 prebuild check covers production) |

### Cleanup / debt

| Item | Notes |
|---|---|
| **Admin-segregation Phase 3 deletion** | After ≥ 1 release cycle of zero `scope: legacy-route` hits in Errors panel, drop legacy pages + middleware + redirect entries. See [runbook](runbooks/admin-segregation-phase3.md) |
| **C13b stable-anchor — Manifesto / Timeline** | Both modules have no single representative title; per-row anchor model needed before they can opt in |
| **C17 field-level sample audit** | Broad per-EItemType coverage exists; open when a client surfaces a specific gap |

### Tests

[`roadmap/tests-remaining.md`](roadmap/tests-remaining.md) — LoginBtn / section snapshots / API integration tests still queued (MongoApi facade + conflict + googleFonts already shipped).

---

## What landed recently

See [`roadmap/shipped.md`](roadmap/shipped.md) for the full archive. Headline this week (2026-04-30 → 2026-05-03):

- **Production:** caching (C9 — bootId + per-feature versions + Caddy SWR + DataLoader), Mongo auth (P5), DO domain wiring (P3), automatic deploy (P2), seamless blue/green (P4)
- **Auth:** Q10 three-dimension grants + 18 admin mutations gated across Posts/Products/Inventory/Orders/Footer/Themes/Languages/Bundle, i18n grant migration on boot
- **Admin platform:** ESLint flat config + VM4 lint rule, **VM3 17/17** complete, L4 public route discovery + composed item-type registry, MCP execution gate (8 advanced-only tools), Things-to-do panel
- **Client platform:** image-ref + link-ref schema convergence (C18), stable anchor emission (C13), image dimensions (C12), client-analytics country lookup with IP discard (CA-geo)
- **Admin shell:** dark-mode + simplified-mode hoisted to top-top bar with chrome-only SCSS scoping, click-to-edit on modules in simplified, favicon, grants UI uses constrained Selects (no free-text)
- **Visual:** regression baselines scaffold (58 specs)
- **Go-to-market:** onboarding wizard + marketing landing + docs site
- **DX:** conditional gqty regen on prebuild (Q6), AppDockerfile `.git-sha` for blue/green commit verification, mcpAgentTools typecheck cleanup, `ui/client/components/` retired
