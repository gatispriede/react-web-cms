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
| F1 | [sub-pages.md](sub-pages.md) | L | New 2026-05-03 — extend single-level page nav to support nested children. Catch-all routing, parent-id refs, anchor registry walk, breadcrumbs. 5 open questions for the design call |

### Bulk migrations

| # | Item | Size | Notes |
|---|------|------|-------|
| AUI-mode | per-feature simplified components | M each | Shell already dispatches via `modes.simplified ?? modes.advanced`; per-pane simplified variants ship the moment they're registered. Needs design per pane (which controls to keep, which to hide). No pane has a `modes.simplified` registered yet |
| EL-feat-rest | edit-levels per-feature `resourceGated` — remaining surfaces | S each | 18 admin mutations are now grant-gated (Posts/Products/Inventory/Orders/Footer/Themes/Languages/Bundle). Remaining surfaces opt in via the same manifest pattern: Sections / Navigation / Seo / Permissions / Users / Audit |

### Visual + observability

| # | Item | Size | Notes |
|---|------|------|-------|
| Q4-cap | initial visual baseline capture | S | `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots` once port 80 is free, then commit `tests/e2e/visual/__snapshots__/` |
| Q5-del | admin-segregation Phase 3 deletion | S | After ≥ 1 release cycle of zero `scope: legacy-route` hits in errors panel, drop the three legacy pages + middleware + redirect entries (see [runbook](../runbooks/admin-segregation-phase3.md)) |

### E2E backlog

| # | Item | Notes |
|---|------|-------|
| 1 | E-commerce real-flow specs | happy-path per feature: products / cart / checkout / inventory / orders. Edge cases deferred |
| 2 | Themes direct-route gqty | `Theme.tsx` at `/admin/client-config/themes` gets empty `mongo.getThemes` from `gqty.resolve` even though raw fetch works. Needs investigation; may resolve after schema regen |
| 3 | gqty schema regen | Run `npm run generate-schema` to surface `isFreshInstall` / `onboardingBootstrap` to typed clients (the Q6 prebuild check covers production builds; this is for dev iteration) |

## Reference docs

- [target-architecture.md](target-architecture.md) — naming conventions + top-level layout the reshape landed on. Open this before proposing structural changes.
- [migration-mapping.md](migration-mapping.md) — full old→new path table from the N15 reshape. Useful when chasing a stale import in docs / legacy notes.
- [shipped.md](shipped.md) — archive of completed items with commit refs.

## Suggested ordering

1. **F1 sub-pages** (new ask) — needs the data-model + nav-render design before code lands; biggest unknown
2. **Q4-cap** — capture visual baselines so subsequent refactors have a safety net
3. **AUI-mode per-pane simplified variants** — start with a high-traffic pane (Posts? Build?) to prove the dispatch surfaces correctly; rest can interleave
4. **EL-feat-rest** — quick mechanical follow-up per loader
5. **E-commerce real-flow specs** — unblocks the e-commerce wiring queue
6. **Q5-del** — only after observation window; pure cleanup
