# Roadmap plans

One markdown per roadmap item. Each file has the same shape:

- **Goal** — what shipping this means
- **Design** — approach, decisions, data model touches
- **Files to touch** — approximate surface
- **Acceptance** — how we know it's done
- **Effort** — rough time budget (see legend)

The headline [ROADMAP.md](../ROADMAP.md) stays as the short bullet list; these files are the "open this before you start" expansions.

Shipped items live in [`shipped.md`](shipped.md) — kept for archaeology, not active triage.

## Universal requirements — every roadmap item

These apply to every active item regardless of size or wave. Treat them as acceptance criteria, not nice-to-haves.

1. **Docs reflect the work.** When an item ships, update — at minimum — the relevant spec doc (mark it shipped or amend), `docs/roadmap/shipped.md`, and any architecture / runbook docs that diverge from the new shape. Inline code comments cover the *why*; markdown docs cover the *where to look first*.
2. **MCP coverage parity for editable surfaces.** Every feature whose content / state / config can be authored through the admin UI must also be manageable via MCP — same operations, same guards. MCP is the canonical write path for AI authoring; admin UI is the human surface on top. New editable field → MCP tool (or extension to an existing tool's schema) lands in the same PR. Read-side parity follows the introspection pattern (`includeUsage` / `includeMissing` / etc. — see [`mcp-bulk-and-introspection.md`](mcp-bulk-and-introspection.md)). Items that touch only infra, tests, or read-only investigations are exempt.
3. **Ship as chunks, not phases.** Each roadmap item is one complete deliverable. No "Phase 1 / Phase 2 / Phase 3" inside an item — that just means three follow-up items, each requiring more context-restoration. If a feature is genuinely too large for one chunk, split it into separately-named roadmap items in `README.md`, each with its own complete acceptance criteria. A chunk lands or doesn't; there's no useful intermediate state to merge. Effort estimates can break down internally (shell ~1.5d, editors ~2.5d, polish ~1d) but those are time-share notes, not separate ship targets.
4. **`data-testid` on every interactive surface.** Any new or modified UI component lands with `data-testid` attributes on every element an e2e test could plausibly target — buttons, inputs, options, list items with identity, modals, drawer toggles, status indicators. Naming convention:
   - **Static elements:** `feature-component-role` (kebab-case) — e.g. `admin-shell-drawer-toggle`, `link-target-picker-search-input`, `themes-pane-bulk-delete-button`.
   - **Items with identity:** `feature-component-{id}` — e.g. `section-row-toggle-{sectionId}`, `link-target-picker-option-{anchorId}`, `gallery-tile-{imageId}`.
   - **State variants:** suffix with `-{state}` when needed — e.g. `section-row-toggle-{id}-expanded`. Prefer toggling a class + asserting via `[data-testid="..."][data-state="expanded"]` over compound testids.
   - **Mode dispatchers (AUI):** prefix with the mode — e.g. `themes-simplified-card-{themeId}` vs `themes-advanced-card-{themeId}` — so e2e specs can target either variant unambiguously.

   E-commerce sweep (shipped 2026-05-03) is the reference precedent: `data-testid` wired across Products / Orders / Storefront / Cart / Checkout. Same conventions apply to every new component going forward.

All four are CI-checkable:
- The schema-drift CI (`tools/scripts/mcp-schema-drift.mjs`) already fails when a GraphQL arg lands without an MCP tool update.
- Add follow-up CI steps: (a) any merged feature commit must touch at least one `docs/` markdown OR pass an explicit "no docs needed" gate in the PR description; (b) `tools/scripts/testid-coverage.mjs` (new) walks new/modified `.tsx` files and warns when an interactive element (`button`, `input`, `Select`, `Modal`, etc.) lacks `data-testid`.

## Effort legend

| Size | Budget | Reality |
|------|--------|---------|
| XS   | < 1 h  | Trivial edit, single file |
| S    | 1–3 h  | Focused change, maybe 1 test |
| M    | 0.5–1 day | Cross-file, needs a quick design call with yourself |
| L    | 1–3 days | New surface, migration, or UX polish loop |
| XL   | 1+ weeks | Architectural — break down further before starting |

Estimates assume one focused engineer already familiar with the codebase. Double for context-switching / review loops.

## Current status (2026-05-04, late)

- **Last master merge:** `2c7be30` (prod-mode smoke + Next 16 dev fixes + themed errors + admin click-parent + F7 sweep + Hero portrait dimension inputs).
- **PROD HOTFIX inbound on develop:** `0390491` — `--webpack` flag on `next build` (`build`, `build-docker`, `start-docker`). Production deploys to funisimo.pro / skyclimber.pro failed health checks because Next 16 defaults `next build` to Turbopack, which rejects the existing `webpack:` block in `ui/client/next.config.js`. Pinning `--webpack` keeps the config honoured. **Awaiting PR develop → master → redeploy.**
- **Develop ahead of master by 7 commits** (one prod-blocker + admin polish + CI-only):
  - `0390491` prod hotfix `--webpack` ← merge first
  - `3959851` admin mode switcher hard-reloads after flip
  - `a12c7b6` unified `[label] [edit] [up] [down] [delete]` action strip
  - `576b212` section-level reorder + module-cluster reposition (superseded by `a12c7b6` but harmless)
  - `cc306a7` initial per-module up/down arrows + label
  - `9373e02` drop master-push trigger from visual regression CI (no baselines yet)
  - `43409e7` smoke spec uses native DOM click on bundle-import confirm (CI flake fix)

## Open queue

### Content editor

| # | Item | Size | Notes |
|---|------|------|-------|
| C13b | link-target stable-anchor — Manifesto only | S | Timeline portion shipped 2026-05-03. Manifesto still needs a per-row anchor model (single body paragraph today, no row identity) |
| C17 | [field-level sample audit](./samples-audit.md) | S | Broad per-EItemType coverage already exists; open when a client surfaces a specific gap |
| F6 | [site-mode-toggle.md](site-mode-toggle.md) | M | Per-site flag: scroll (single-page sections) vs multipage (current default). Footer nav, header nav, and SSR routing branch on it. Phased plan: (1) unify scroll/multipage shell incl. mobile menu — fixes the visible styling drift; (2) `SiteFooter` mode prop with hash-anchor rewrite; (3) proper `siteMode` enum flag (`scroll \| multipage \| auto`) + admin Select; (4) `getStaticProps` mode branch in catch-all + `index.tsx` |
| Mobile column behavior | [mobile-column-behavior.md](mobile-column-behavior.md) | S (~1 day) | **Section-level** `ISection.layout.mobileBehavior: 'stack'\|'collapse'\|'keep-ratio'`. `'collapse'` uses drawer-style accordion with chevron-rotate, mirroring the existing public-side `MobileNav` pattern (consistent gesture across the mobile UX). Shared `@mixin section-row-collapsible` in `ui/client/styles/Common/_responsive.scss` — reused by the Mobile-friendly admin chunk so both surfaces collapse the same way. Section-level rather than module-level keeps DRY (5+ multi-column modules would otherwise carry the same field); per-module override added later if a real case appears. Visual reference: impeccable design plugin's collapsible-content patterns. |
| Bundle-import restart | bundle-import → `markRestartRequired()` hook | S | Currently a successful import doesn't surface the "restart to pick up new modules" hint. Wire through the existing flag |
| Section drag-reorder bug | original report; up/down arrows are the workaround | M | Drag-reorder for both sections and per-module rows stopped working at some point. The new explicit up/down + label cluster (commits `a12c7b6` + `cc306a7`) is the immediate user-facing fix. Root cause investigation deferred — find why the existing `getChangedPos` + `DraggableWrapper` chain stopped firing |
| Deploy auto-rollback on health-check fail | keep previous container alive until new one is healthy | S | The default (non-seamless) deploy path runs `docker compose up --no-deps --build -d app` which recreates the `front` container atomically — but if `next build` fails inside the new image (as it just did with the `--webpack` hotfix), the old container is gone and the site is down until the next deploy. Two paths: (a) tag the previous `app:current` image before rebuild, restore it if the new container's health check fails; or (b) promote `SEAMLESS_DEPLOY=1` to default since `tools/blue-green-deploy.sh` already keeps both slots alive. Filed 2026-05-04 after the `--webpack` prod outage |
| Mobile-friendly admin | [mobile-friendly-admin.md](mobile-friendly-admin.md) | L | Operator-grade editing on a phone. Shell drawer + editor row collapse + image tray + PWA + presence + pull-to-refresh shipped together as one chunk. Reuses the shared `@mixin section-row-collapsible` from the public-side mobile column work. Acceptance: full content-edit round-trip on mobile Safari without horizontal scroll. |
| Terraform + Kamal migration | [terraform-kamal-migration.md](terraform-kamal-migration.md) | L (~7 days) | Single chunk that replaces the bash deploy stack end-to-end: Terraform-imported infra + GHCR-built images + Kamal app deploy + cutover of both droplets. Subsumes the previously-separate Image-registry / Declarative-env / Terraform-droplet items — they shipped half-migrated states; doing them as one chunk avoids that. Eliminates 6-8min cold deploys and the entire 250-line inline ssh script. |

### Bulk migrations

| # | Item | Size | Notes |
|---|------|------|-------|
| AUI-mode | [aui-mode-hierarchy.md](aui-mode-hierarchy.md) | M each | Hierarchy decided 2026-05-07: **simplified is the base; advanced composes simplified + extras**. Both variants co-located under `ui/admin/features/<Name>/` (no parallel hierarchy). Lazy-loaded so simplified mode never downloads advanced. Optional site-flag gating per advanced sub-feature. Themes + Posts already ship both variants; refactor them onto the inheritance shape (~1 day total) before onboarding more panes. Suggested rollout order: Navigation → Modules → Inquiries → Languages → Bundle → Users → SEO. |

### MCP — F8 deferred

| # | Item | Size | Notes |
|---|------|------|-------|
| F8-stream | streaming transport for bundle/image tools | M | Long-running tools (bundle export, image rescan) currently buffer; streaming progress events queued for post-merge |
| F8-e2e | un-skip MCP E2E suite | S | Spec exists; `test.skip` blocks pending fixture wiring |
| F8-bulk-introspection | [mcp-bulk-and-introspection.md](mcp-bulk-and-introspection.md) | M-L (~3 days) | Two parallel gaps. **Bulk-write**: extend ~12 mutation tools (`section.update`, `module.add/update/remove`, `page.update`, `post.upsert`, `product.create/update`, `permission.grant/revoke`, `user.setRole/update`, `translation.delete`, `trash.restore/purge`) with optional `items[]` / `ids[]` arrays. Reference impl: `image.delete { ids[] }` shipped 2026-05-07. **Introspection**: extend ~10 `*.list` tools with aggregating flags (`i18n.listLanguages { includeMissing }` for translation gap analysis, `theme.list { includeUsage }`, `page.list { includeSeoStatus }`, `user.list { includeActivity }`, etc.). Reference impl: `image.list { includeUsage }` same day. Plus `i18n.diff` + `i18n.scanCodebase` translation-specific helpers — agent-driven translation work needs server-side missing-key matrix instead of dumping every locale into context. Same shared scanner pattern as `ImageUsageService` so admin UI's "show unused / missing" filters reuse the backend |

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

## Suggested ordering — big to small (2026-05-07)

Strict size-first ordering: largest items lead so deep work isn't fragmented; quick wins fill the tail. Dependencies override pure size-order in two places — flagged inline.

### Wave 1 — L (1-3 days each, shipped as chunks)

1. **Mobile-friendly admin** — [`mobile-friendly-admin.md`](mobile-friendly-admin.md). ~5 days. Shell drawer + editor row collapse + image tray + PWA + presence + pull-to-refresh ship together as one chunk. Reuses SCSS mixin from Wave 2 mobile column work — schedule mobile column either before or in parallel since the mixin is what feeds both surfaces.
   - **Dependency exception:** Q4-cap visual baselines (Wave 3) ideally lands first — the chunk is structural enough that silent regressions become possible without baselines.
2. **Terraform / Kamal migration** — [`terraform-kamal-migration.md`](terraform-kamal-migration.md). ~7 days. Terraform-imported infra + GHCR-built images + Kamal app deploy migrate together. Splitting would mean half-migrated states (kamal targeting un-imported infra, etc.). Internal execution order is detailed in the spec; the deliverable is the whole migration including cutover of both droplets.

### Wave 2 — M (0.5-2 days each, shipped as chunks)

3. **F8-bulk-introspection** — [`mcp-bulk-and-introspection.md`](mcp-bulk-and-introspection.md). ~3 days. Bulk-write extensions + introspection flags + per-feature scanners + translation helpers all ship together. Unblocks translation work + bulk authoring via MCP.
4. **F6 site-mode-toggle** — [`site-mode-toggle.md`](site-mode-toggle.md). ~1-2 days. Flag + admin Select + nav/footer mode-aware rendering + getStaticProps branch + runbook + tests as one chunk. Also resolves the standing scroll-vs-menu styling drift.
5. **F8-stream** — streaming transport for `bundle.export` / `image.rescan`. Pair with mcp-rollout #12 (bundle sanitiser fix) — the same flow gets stress-tested.
6. **Section drag-reorder root cause** — investigate why `getChangedPos` + `DraggableWrapper` chain stopped firing. Up/down arrows already ship as workaround.
7. **link-target-autosearch** — [`link-target-autosearch.md`](link-target-autosearch.md). ~2 days. Picker + anchor registry + MCP tools + every editor swap (~8 surfaces) as one chunk. **Depends on F6** (picker emits `/page#anchor` vs `/#anchor` based on mode).
8. **AUI mode infrastructure refactor** — [`aui-mode-hierarchy.md`](aui-mode-hierarchy.md). ~1 day. Refactor existing Themes + Posts onto inheritance shape + ESLint rule + lazy-load convention. Foundational chunk; subsequent per-pane onboardings (Navigation, Modules, Inquiries, …) are each their own roadmap items, picked up by demand.
9. **E-commerce real-flow specs** — happy-path per feature: products / cart / checkout / inventory / orders.

### Wave 3 — S (1-3 hours each)

10. **Q4-cap visual baselines** — capture mobile + desktop. **Should land before Wave 1 Mobile-friendly admin** to protect the chunk against silent regressions.
11. **Mobile column behavior** — [`mobile-column-behavior.md`](mobile-column-behavior.md). ~1 day. Section-level `mobileBehavior` enum + drawer accordion mixin + admin Select + e2e visual baselines as one chunk. The shared `@mixin section-row-collapsible` is what Mobile-friendly admin reuses, so this lands first or in parallel.
12. **C13b Manifesto link-target** — depends on link-target-autosearch landing first.
13. **Bundle-import restart hook** — `markRestartRequired()` wiring.
14. **F8-e2e** — un-skip MCP E2E suite + re-enable e2e.yml triggers (mcp-rollout #10 same workstream).
15. **mcp-rollout aftermath quick fixes** — single chunk batching the trivial fixes:
    - `#1` section.update description / upsert (1 line)
    - `#5` admin:bundle scope in dev-token (1 line)
    - `#9` `page.touch` MCP tool (audit-triplet stamp)
    - `#11` INFRA_TOPOLOGY normalize step
    - `#12` bundle sanitiser fix
16. **Q5-del** — admin-segregation Phase 3 cleanup after ≥1 release with zero `legacy-route` errors.
17. **Themes direct-route gqty** — `Theme.tsx` empty fetch investigation.

### Wave 4 — XS

18. **gqty schema regen** — surfaces `isFreshInstall` / `onboardingBootstrap` to typed clients.

### Backlog — concrete-trigger parking lot

Items deferred until a real driver appears (third-party plugin author, customer ask, recurring bug, external dependency). Not budgeted in any wave. See [`backlog.md`](backlog.md) for the full list. Currently parked: **F8-sdk** plugin SDK · **C17** sample audit · Mobile-friendly admin **native wrapper** · mcp-rollout `#8` Mongo healthcheck · per-page site-mode toggle.
