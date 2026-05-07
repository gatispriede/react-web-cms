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
| Mobile column behavior | per-module flag for stack-order or keep-ratio | S | Today every multi-column section collapses 50/50 → 100/100 on mobile in DOM order. Per-module flag (probably 3 values: `stack` default, `keep-ratio`, `reorder-N`) gives authors control over whether a row collapses + which side comes first. Filed 2026-05-04 by client feedback; no spec doc yet, just a note |
| Bundle-import restart | bundle-import → `markRestartRequired()` hook | S | Currently a successful import doesn't surface the "restart to pick up new modules" hint. Wire through the existing flag |
| Section drag-reorder bug | original report; up/down arrows are the workaround | M | Drag-reorder for both sections and per-module rows stopped working at some point. The new explicit up/down + label cluster (commits `a12c7b6` + `cc306a7`) is the immediate user-facing fix. Root cause investigation deferred — find why the existing `getChangedPos` + `DraggableWrapper` chain stopped firing |
| Deploy auto-rollback on health-check fail | keep previous container alive until new one is healthy | S | The default (non-seamless) deploy path runs `docker compose up --no-deps --build -d app` which recreates the `front` container atomically — but if `next build` fails inside the new image (as it just did with the `--webpack` hotfix), the old container is gone and the site is down until the next deploy. Two paths: (a) tag the previous `app:current` image before rebuild, restore it if the new container's health check fails; or (b) promote `SEAMLESS_DEPLOY=1` to default since `tools/blue-green-deploy.sh` already keeps both slots alive. Filed 2026-05-04 after the `--webpack` prod outage |
| Mobile-friendly admin | [mobile-friendly-admin.md](mobile-friendly-admin.md) | L | Admin SPA today is desktop-first — sider clips on phones, multi-column editors stack badly, drag-reorder needs a mouse, image rail expects a wide canvas. Three phases: (1) shell — sider becomes drawer below 768 px, top bar shrinks, safe-area handling; (2) editors — every multi-column row collapses, InlineEdit gets long-press fallback, image rail folds into a sticky-bottom tray, modals → bottom sheets, form fields hit 44 px; (3) polish — admin PWA manifest, presence stacking, pull-to-refresh on inquiries. Acceptance: full content-edit round-trip on mobile Safari without horizontal scroll. Goal is operator-grade editing on a phone, not a responsive paint job |
| **Image registry (GHCR) + push-based deploy** | build once in CI, droplet pulls instead of building | M (~half day) | Biggest single deploy-fragility win. Today every deploy runs `next build` inside the freshly-recreated container (per `start-docker`: `next build && next start`) → 6-8 min cold start, during which Caddy serves the maintenance page if upstreams flip wrong. Push the built `node-app:<sha>` image to GHCR from CI; droplet does `docker pull + up -d` only. Cold start drops to ~30 sec. **Cost:** GHCR free for public repos; private = $0/mo for first 500MB then $0.25/GB·mo storage + $0/inbound (droplet pulls are inbound to droplet → free; DO doesn't charge inbound traffic). Realistic: $0-3/mo for 5-10 SHA-tagged images at ~1.2 GB each. Alternatives: Docker Hub free for 1 private repo, or DO Container Registry $5/mo starter. Filed 2026-05-04 after a day of seamless-flip incidents traceable mostly to in-droplet builds. |
| Declarative `.env` (split static vs runtime) | stop CI from clobbering ACTIVE_UPSTREAM | S | Twin of the image-registry item. Today `ci.yml` rewrites `/opt/cms/.env` from `DEPLOY_ENV_FILE_n` secret on every deploy, wiping the runtime-managed `ACTIVE_UPSTREAM=app-{blue,green}:80` that `blue-green-deploy.sh` writes. Already mitigated in `a713bd4` via in-place preservation, but the cleaner shape is split: `.env.static` (from secret, never modified at runtime) + `.env.runtime` (Caddy reads both, blue-green-deploy.sh only ever touches the second). Removes a class of "where did this env var go?" bugs. **Cost:** $0. |
| Terraform droplet + DNS + firewall | replace imperative SSH bootstrap with declarative IaC | L (1-2 days) | Lower urgency than image-registry. Replaces the `apt install + systemctl + Caddy + nginx-evict + sshd-harden` bootstrap currently in `ci.yml` with `terraform apply`. Multi-droplet provisioning becomes adding a matrix entry. Diff before apply prevents surprise rewrites. **Cost:** Terraform itself free. State backend: Terraform Cloud free tier (5 users, 500 resources) or DO Spaces $5/mo for state. ~$0-5/mo. **Counter-argument:** TF doesn't fix `next build`-in-container time, doesn't fix bash parse errors (it removes the bash entirely though), and adds a learning curve. The image-registry change buys more uptime per dev hour. |

### Bulk migrations

| # | Item | Size | Notes |
|---|------|------|-------|
| AUI-mode | per-feature simplified components | M each | Shell dispatches via `modes.simplified ?? modes.advanced`. Themes + Posts shipped; rest opt in by registering `modes.simplified` on their loader. Needs design per pane (which controls to keep, which to hide) |

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

### Wave 1 — L (1-3 days each)

1. **Mobile-friendly admin** — `mobile-friendly-admin.md`. Three independently-mergeable phases (shell drawer → editors → polish + PWA). ~5 days realistic. Reuses SCSS mixin from Wave 2 mobile column work, so mergeable in either order.
   - **Dependency exception:** Q4-cap visual baselines (Wave 3) ideally lands first — every shell + editor change otherwise risks silent regression. Acceptable to start admin Phase 1 in parallel since shell scope is small.
2. **Terraform / Kamal full migration** — `terraform-kamal-migration.md`. 7 days across 6 phases. GHCR push-based deploy is Phase B internally; rest of the migration follows.

### Wave 2 — M (0.5-2 days each)

4. **F8-bulk-introspection** — `mcp-bulk-and-introspection.md`. ~3 days. Unblocks translation work + bulk authoring via MCP. Reusable scanner pattern feeds admin "show unused / missing" filters.
5. **F6 site-mode-toggle** — `site-mode-toggle.md`. ~1-2 days, four phases. Phase 1 (shell + mobile-menu unification) also resolves the standing styling drift.
6. **F8-stream** — streaming transport for `bundle.export` / `image.rescan`. Pair with mcp-rollout #12 (bundle sanitiser fix) — the same flow gets stress-tested.
7. **Section drag-reorder root cause** — investigate why `getChangedPos` + `DraggableWrapper` chain stopped firing. Up/down arrows already ship as workaround.
8. **link-target-autosearch** — `link-target-autosearch.md`. Picker + anchor registry. **Depends on F6** (picker emits `/page#anchor` vs `/#anchor` based on mode).
9. **AUI mode per-pane** — Themes + Posts proved the dispatch; pick next high-traffic pane. Slot one pane at a time.
10. **E-commerce real-flow specs** — happy-path per feature: products / cart / checkout / inventory / orders.

### Wave 3 — S (1-3 hours each)

11. **Q4-cap visual baselines** — capture mobile + desktop. **Should land before Wave 1 Mobile-friendly admin Phase 2**.
12. **Mobile column behavior flag** — per-module `stack` / `keep-ratio` / `reorder-N`. SCSS approach reused by Mobile-friendly admin Phase 2.
13. **C13b Manifesto link-target** — depends on link-target-autosearch landing first.
14. **Bundle-import restart hook** — `markRestartRequired()` wiring.
15. **Declarative .env split** — `.env.static` (CI-managed) + `.env.runtime` (deploy-script-managed). Removes a class of "where did this var go?" bugs.
16. **Deploy auto-rollback** — likely obsoleted by GHCR (Terraform Phase B). Verify after GHCR ships; close as won't-do if obsolete.
17. **F8-e2e** — un-skip MCP E2E suite + re-enable e2e.yml triggers (mcp-rollout #10 same workstream).
18. **mcp-rollout aftermath quick fixes:**
    - `#1` section.update description / upsert (1 line)
    - `#5` admin:bundle scope in dev-token (1 line)
    - `#9` `page.touch` MCP tool (audit-triplet stamp)
    - `#11` INFRA_TOPOLOGY normalize step
    - `#12` bundle sanitiser fix
19. **Q5-del** — admin-segregation Phase 3 cleanup after ≥1 release with zero `legacy-route` errors.
20. **Themes direct-route gqty** — `Theme.tsx` empty fetch investigation.

### Wave 4 — XS

21. **gqty schema regen** — surfaces `isFreshInstall` / `onboardingBootstrap` to typed clients.

### Potential — concrete-trigger backlog

Items deferred until a real driver appears (third-party plugin author, customer ask, recurring bug, external dependency). Not budgeted in any wave. See [`potential.md`](potential.md) for the parking lot. Currently parked: **F8-sdk** plugin SDK · **C17** sample audit · Mobile-friendly admin **native wrapper** · mcp-rollout `#8` Mongo healthcheck · per-page site-mode toggle.
