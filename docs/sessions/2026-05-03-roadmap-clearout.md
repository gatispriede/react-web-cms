# Session 2026-05-03 — roadmap clear-out

Two-day push that drained the open content-editor + go-to-market + production-ops queues. Counted 17 commits on `develop` since `b83f63a`.

## What landed

| Area | Commit(s) | Summary |
|------|-----------|---------|
| **Content editor** | `c6608b7` `1fe0aa6` `18ea708` `b79d221` `b129682` | Visual regression baselines (58); production caching (bootId + per-feature versions + Caddy SWR + DataLoader fold-in); image-ref + link-ref schema convergence; ESLint flat config + VM4 lint rule + Themes/Translations VM migration |
| **Build / DX** | `8a607b6` `2cf1ca5` | Conditional gqty regen on prebuild; admin-segregation Phase 3 observability (middleware + runbook) |
| **Auth / multi-tenancy** | `4d1e31d` | Edit-levels three-dimension grants (feature / page / locale) with intersection semantics + admin bypass |
| **Production ops** | `a193ae3` `6237fa0` | Mongo auth + DO domain wiring + automatic deployment workflow; blue/green seamless deployment via Caddy upstream switch |
| **Go-to-market** | `d9a7728` `5e19a4c` `23943e5` `e207d87` | First-run onboarding wizard; marketing landing page + fresh-install homepage flip; markdown-to-bundle docs site |
| **Hotfixes / shell** | `6ab7322` `a66c3de` `fef4e49` | Build-page hang fix (REST instead of stale gqty); favicon route; dark-mode + simplified-mode hoisted to top-top bar with chrome-only scoping; click-to-edit on modules in simplified mode |

## Architecture deltas

- **Cache invalidation contract:** every `ServiceLoader` declares `cacheVersionKeys: string[]`. `runMutation` bumps Redis version stamps for every listed key. Public responses carry `X-Cms-Cache-Tag: <bootId>;feature=ver,…` for Caddy SWR keying.
- **Embedded image / link shape:** modules read/write through `IImageRef` (`{src, alt?, width?, height?}`) and `ILinkRef` (`{url, label?}`). Each module's `ContentManager.data` getter normalises legacy `{src, imgWidth, imgHeight}` and `{url, label, ...siblings}` into the canonical shape. Save-side emits new shape only.
- **Per-resource gating:** mutations declare `resourceGated: {dimensions, extractor}`. The extractor returns `{feature?, page?, locale?}`; user must hold a matching `Grant` for every declared dimension (intersection). Admin role rank bypasses. Posts wired as the reference example.
- **Simplified vs advanced UI mode:** `getCachedMode()` is the synchronous read used in non-hook contexts. The shell hides Areas (SEO / Release / System), area items (Products / Inventory / Orders), Layout pane sub-sections (everything past the Tabs/Scroll Radio), and module picker entries beyond the curated 8-type set. The AddNewSectionItem drawer drops the Action tab + section transparency + style sub-options. EditWrapper forwards body clicks to the per-module edit button when admin + simplified.

## Roadmap status

Items below are the cleared queue from `docs/roadmap/README.md` + the ROADMAP.md "Queued" / "Pending" sections.

### Shipped this session
- C9 production caching, C12 image dimensions, C13 stable anchor emission (Hero/BlogFeed/ProjectCard), C14 inline-edit autofocus on add, C15/C16 (already shipped, advertised), C17 partial, C18 image+link refs
- Q1 ESLint flat config, Q2 VM3 (Themes + Translations), VM4 lint rule (other panes carry explicit `eslint-disable` markers — VM3 is **not** 17/17)
- Q4 visual regression baselines (config + spec files only — image capture pending a free port-80)
- Q5 admin-segregation Phase 3 observability (deletion deferred to a future cycle after watch-period proves zero traffic)
- Q6 conditional gqty regen on prebuild
- Q7 onboarding wizard + landing page + docs site
- Q8 P5 Mongo auth + P3 DO domain + P2 automatic deployment
- Q10 edit-levels grants (Posts is the reference; other features can opt in via manifest)
- P4 seamless (blue/green) deployment

### Still pending
- **VM3 sub-panes** — ~10 admin panes still on `useState` with explicit lint-disable markers (Agent, Analytics, Bundle helpers, ModulePicker, AddNewLanguageDialog, ImageRail, FeatureFlags, RestartRequiredBanner, SEO, FontPicker)
- **C17 exhaustive sample audit** — broad per-EItemType coverage exists; field-level audit deferred until a client surfaces a specific gap
- **#9 tests-remaining** — LoginBtn / section snapshots / API integration tests still queued
- **Visual baseline image capture** — run `npm run e2e:isolated -- tests/e2e/visual/ --update-snapshots` when port 80 is free
- **Admin-segregation Phase 3 deletion** — after the 1-week observation window, drop `/admin/settings`, `/admin/languages`, `/admin/modules-preview` page files + middleware + redirect entries
- **L4 public route discovery** + **L4 item-types migration** — bulk migrations
- **client-analytics country-code GeoLite** — needs the MaxMind DB downloaded + a deploy hook
- **edit-levels admin UI for grant assignment** — Q10 wired the schema + a per-user grants UI; per-feature opt-in (other features need their own `resourceGated` declarations)
- **P4 follow-up** — `infra/AppDockerfile` should emit `/app/.git-sha` so the blue/green script's commit-hash check is non-no-op
- **C13 stable-anchor for Manifesto / Timeline** — both modules have no single representative title; deferred until a per-row anchor model lands

## Known issues + technical debt
- Pre-existing `services/agent/mcpAgentTools.ts` typecheck error (unrelated to this session)
- Q7 docs bundle generator (`tools/seed-docs-bundle.js`) needs to be run once: `node tools/seed-docs-bundle.js` then admin imports the bundle
- gqty client wasn't regenerated after Q7 added `isFreshInstall` / `onboardingBootstrap` SDL — the AdminApp first-run guard now uses REST so this isn't blocking, but `npm run generate-schema` is still needed to expose the GraphQL surface to typed clients
