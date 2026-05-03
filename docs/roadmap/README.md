# Roadmap plans

One markdown per roadmap item. Each file has the same shape:

- **Goal** — what shipping this means
- **Design** — approach, decisions, data model touches
- **Files to touch** — approximate surface
- **Acceptance** — how we know it's done
- **Effort** — rough time budget (see legend)

The headline [ROADMAP.md](../ROADMAP.md) stays as the short bullet list; these files are the "open this before you start" expansions.

Shipped items live in [`shipped.md`](shipped.md) — kept for archaeology, not active triage.

## Effort legend

| Size | Budget | Reality |
|------|--------|---------|
| XS   | < 1 h  | Trivial edit, single file |
| S    | 1–3 h  | Focused change, maybe 1 test |
| M    | 0.5–1 day | Cross-file, needs a quick design call with yourself |
| L    | 1–3 days | New surface, migration, or UX polish loop |
| XL   | 1+ weeks | Architectural — break down further before starting |

Estimates assume one focused engineer already familiar with the codebase. Double for context-switching / review loops.

## Open queue

### Content editor

| # | Item | Size | Notes |
|---|------|------|-------|
| 9 | [tests-remaining.md](tests-remaining.md) | L | LoginBtn / section snapshots / API integration tests still queued (MongoApi facade + conflict + googleFonts already shipped) |
| C13b | link-target stable-anchor — Manifesto / Timeline | S | Per-row anchor model needed before these can opt in (no single representative title) |
| C17 | [field-level sample audit](./samples-audit.md) | S | Broad per-EItemType coverage already exists; open when a client surfaces a specific gap |
| F1 | [sub-pages.md](sub-pages.md) | L | New 2026-05-03 — extend single-level page nav to support nested children. See plan below + dedicated spec |

### Bulk migrations (mechanical, scope known)

| # | Item | Size | Notes |
|---|------|------|-------|
| VM3-rest | sub-panes still on useState | M | ~10 panes carry explicit `eslint-disable-next-line no-restricted-imports` markers: Agent, Analytics, Bundle helpers, ModulePicker, AddNewLanguageDialog, ImageRail, FeatureFlags, RestartRequiredBanner, SEO, FontPicker |
| L4-routes | public route discovery | S | Read `ClientUILoader.publicRoutes`; auto-apply `withFeatureGate`; replace per-page wiring in `pages/` |
| L4-items | item-types migration | M | Move per-feature off the flat `ui/admin/lib/itemTypes/registry.ts` to `ClientUILoader.itemTypes` + `AdminUILoader.itemTypeEditors` pairs |
| EL-feat | edit-levels per-feature `resourceGated` | Shipped (in progress) | Posts (reference, Q10) ✓ · Products ✓ · Inventory ✓ · Orders (admin-only mutations) ✓ · Footer ✓ · Themes ✓ · Languages (`{feature, locale}`) ✓ · Bundle (declared, routes still HTTP) ✓ — 18 mutations now `resourceGated` across the codebase. Remaining surfaces (Sections / Navigation / Seo / Permissions / Users / Audit) opt in via the same manifest pattern |
| EL-i18n | edit-levels i18n migration | Shipped | Boot-once: `LanguagesServiceLoader.onBoot` runs `runI18nGrantMigration(db)` — when `siteFlags.inlineTranslationEdit === true`, grants `translator` to every editor-rank user, then sets the flag to `false`. Idempotent — re-runs on every boot are no-ops once the flag is dropped |
| AUI-mode | per-feature simplified components | M each | The shell already dispatches via `modes.simplified ?? modes.advanced`; per-pane simplified variants ship the moment they're registered |
| AUI-mcp | MCP execution gate | S | `enforceModeForTool(userId, toolId)` helper at the top of advanced-only MCP tool resolvers; throws `FeatureRestrictedError` when the calling user is in simplified mode |
| AUI-todo | "Things to do" panel | M | Shared component used by simplified dashboard + the queued onboarding wizard |
| ~~CA-geo~~ | ~~client-analytics country lookup~~ | S | **Shipped** 2026-05-03 — IP2Location LITE DB1 (CC0) seed at `infra/datasets/ip-to-country.json`; `geoLookup()` derives a 2-letter country at ingest and discards the IP. See [runbook](../runbooks/analytics-geolookup.md). |

### Visual + observability

| # | Item | Size | Notes |
|---|------|------|-------|
| Q4-cap | initial visual baseline capture | S | `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots` once port 80 is free, then commit `tests/e2e/visual/__snapshots__/` |
| Q5-del | admin-segregation Phase 3 deletion | S | After ≥ 1 release cycle of zero `scope: legacy-route` hits in errors panel, drop the three legacy pages + middleware + redirect entries (see [runbook](../runbooks/admin-segregation-phase3.md)) |
| P4-sha | emit `/app/.git-sha` in AppDockerfile | XS | Blue/green script's commit-hash check no-ops without it. Dockerfile needs `RUN echo "$(git rev-parse HEAD 2>/dev/null || echo unknown)" > /app/.git-sha` |

### E2E backlog

1. **E-commerce real-flow specs** — happy-path per feature: products / cart / checkout / inventory / orders. Edge cases deferred.
2. **Themes direct-route gqty** — `Theme.tsx` at `/admin/client-config/themes` gets empty `mongo.getThemes` from `gqty.resolve` even though raw fetch works. Needs investigation; may resolve after schema regen.

## Reference docs

- [target-architecture.md](target-architecture.md) — naming conventions + top-level layout the reshape landed on. Open this before proposing structural changes.
- [migration-mapping.md](migration-mapping.md) — full old→new path table from the N15 reshape. Useful when chasing a stale import in docs / legacy notes.
- [shipped.md](shipped.md) — archive of completed items with commit refs.

## Suggested ordering

1. **F1 sub-pages** (new ask) — needs the data-model + nav-render design before code lands; biggest unknown
2. **Q4-cap** — capture visual baselines so subsequent refactors have a safety net
3. **VM3-rest** + **AUI-mode** per-pane simplified variants — paired; both touch the same admin features
4. **L4-routes** + **L4-items** + **EL-feat** — mechanical follow-ups, can interleave
5. **CA-geo** — independent, ship whenever the deploy hook is convenient
6. **Q5-del** — only after observation window; pure cleanup
