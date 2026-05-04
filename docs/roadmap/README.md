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
| C13b | link-target stable-anchor — Manifesto only | S | Timeline portion shipped 2026-05-03. Manifesto still needs a per-row anchor model (single body paragraph today, no row identity) |
| C17 | [field-level sample audit](./samples-audit.md) | S | Broad per-EItemType coverage already exists; open when a client surfaces a specific gap |
| F6 | [site-mode-toggle.md](site-mode-toggle.md) | M | Per-site flag: scroll (single-page sections) vs multipage (current default). Footer nav, header nav, and SSR routing branch on it |
| Bundle-import restart | bundle-import → `markRestartRequired()` hook | S | Currently a successful import doesn't surface the "restart to pick up new modules" hint. Wire through the existing flag |

### Bulk migrations

| # | Item | Size | Notes |
|---|------|------|-------|
| AUI-mode | per-feature simplified components | M each | Shell dispatches via `modes.simplified ?? modes.advanced`. Themes + Posts shipped; rest opt in by registering `modes.simplified` on their loader. Needs design per pane (which controls to keep, which to hide) |

### MCP — F8 deferred

| # | Item | Size | Notes |
|---|------|------|-------|
| F8-stream | streaming transport for bundle/image tools | M | Long-running tools (bundle export, image rescan) currently buffer; streaming progress events queued for post-merge |
| F8-sdk | plugin SDK for third-party MCP tools | L | Surface `defineTool` + `compose` as a public API so plugins can register without touching core |
| F8-e2e | un-skip MCP E2E suite | S | Spec exists; `test.skip` blocks pending fixture wiring |

### Visual + observability

| # | Item | Size | Notes |
|---|------|------|-------|
| Q4-cap | initial visual baseline capture | S | `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots` once port 80 is free, then commit `tests/e2e/visual/__snapshots__/`. Also pin the 1ms instant-fail diagnosis |
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

1. **F6 site-mode toggle** — biggest open feature; scroll vs multipage flag with footer/header/routing branches
2. **Q4-cap** — capture visual baselines so subsequent refactors have a safety net
3. **Bundle-import restart hook** — XS wiring, removes a real operator paper-cut after each import
4. **F8 deferred (streaming + plugin SDK + E2E un-skip)** — interleave; streaming is highest-value for the long-running tools
5. **AUI-mode per-pane simplified variants** — Themes + Posts proved the dispatch; pick the next high-traffic pane
6. **E-commerce real-flow specs** — unblocks the e-commerce wiring queue
7. **Q5-del** — only after observation window; pure cleanup
