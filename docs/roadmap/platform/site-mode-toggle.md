# F6 — site-mode toggle: scroll vs multipage

> **SHIPPED 2026-05-14.** Implemented as `siteFlags.layoutMode: 'tabs' | 'scroll' | 'auto'`
> (the spec's working name `siteMode` / `'multipage'` was superseded — `'tabs'` is
> the spec's `'multipage'`). Full chunk landed: flag definition + default +
> read path (`SiteFlagsService` + `resolveLayoutMode()`), public-site render
> branch (`app.tsx` scroll vs tabs), nav/footer mode-aware rendering
> (`MainMenu`, `SiteFooter`, `ScrollNav`), anchor registry (`AnchorRegistry`),
> admin control (`ui/admin/features/Navigation/Layout.tsx` +
> `LayoutViewModel`), MCP coverage (`site.setLayoutMode`), runbook
> (`docs/runbooks/site-mode-switch.md`), and architecture doc
> (`docs/architecture/site-flags.md`). The four "Open questions" below were
> all resolved as the doc recommended: default `auto` → `tabs`, no
> auto-detection heuristic, sub-pages flatten in scroll mode.
>
> Naming note: the spec proposed a net-new `siteMode` field; the codebase
> already had `layoutMode` carrying the exact same semantics, so the
> implementation extended `layoutMode` rather than introducing a duplicate
> flag. `'tabs'` ≡ spec `'multipage'`; `'scroll'` and `'auto'` match the spec.
> MCP note amended: a dedicated `site.setLayoutMode` tool ships instead of
> overloading `site.setFeatureFlag` (which targets boot-time feature
> manifests, a different surface).

## Goal

Per-site `siteFlags.siteMode: 'scroll' | 'multipage'` (or `'auto'` — derive from page count). When `scroll`, every page's sections render on `/` as a single long page; nav + footer use `#anchor` links to scroll. When `multipage`, F1 routing applies — each page is its own URL.

Today F1 forced every site into multipage mode. Customers like skyclimber.pro authored their content for scroll-mode (footer entries are `#sakums`, `#pakalpojumi`, etc.); the bundle import preserves that authoring intent but F1 broke the rendering contract. Either patch the bundle every time or give the site a switch.

Out of scope: per-page mode (mixing scroll + multipage on the same site). Pure global toggle.

## Why now

- Skyclimber.pro has `#anchor` footer URLs from scroll-era authoring; bundle import + multipage rendering = broken footer + redundant page routes nobody navigates.
- A "single landing page" portfolio site is a real customer pattern — F1 sub-pages is for sites with 5+ distinct pages, not 4 sections that flow as one narrative.
- The choice is data-driven (siteFlag), not code-driven, so a single deploy serves both modes.

## Design

### Flag

`siteFlags.siteMode: 'scroll' | 'multipage' | 'auto'`. Default `auto`:
- `auto` resolves to `'scroll'` if total pages ≤ 1, else `'multipage'`. This matches existing behavior for old single-page sites without breaking F1 sites.
- Operators can pin explicit `'scroll'` or `'multipage'` to override.

### Public route resolution

`pages/[lang]/[...slug].tsx` keeps the catch-all but consults `siteMode` in `getStaticProps`:
- **`multipage`** — current behavior. Resolves slug-chain to a single page; renders that page's sections only.
- **`scroll`** — root `/` renders ALL pages' sections concatenated in nav order; deeper paths 404 (they don't exist as routes). Nav builds `<a href="#section-id">` instead of `<Link href="/page-slug">`.

The catch-all + a top-level `pages/index.tsx` already share `app.tsx`. Branch in `app.tsx`'s render based on the resolved mode.

### Footer + nav rendering

`MainMenu.tsx` + `SiteFooter.tsx` accept the mode prop and render hash-anchors when `scroll`:
- `MainMenu` — items use `href="#${slugifyAnchor(page.page)}"` instead of `/${slug}`.
- `SiteFooter` — entries that look like a page reference (label matches a page name OR url already starts with `#`) get rewritten to `#${slugifyAnchor(page.page)}` instead of forcing a page route.
- Smooth-scroll on hash click (existing pattern from pre-F1 single-page mode — keep it).

### Admin toggle

`/admin/seo` (or `/admin/client-config`) gets a Site mode select with the three options. `siteFlags` already exists; one new field. Save bumps the seo cacheVersion.

### Bundle compat

Existing scroll-mode bundles (skyclimber) have:
- `footer.columns[].entries[].url` like `#sakums` — kept as-is in scroll mode.
- `siteMode` flag may be missing — defaults to `auto` which picks `scroll` for ≤1-page sites and `multipage` for > 1.

Wait — skyclimber has 4 pages but is scroll-mode. So `auto` picking by page count is wrong. Better: `auto` defaults to `multipage` for safety (matches F1's current behavior); operator explicitly opts into `scroll` if their site is single-narrative. The 4-page-but-scroll-mode case is rare enough that operator action is OK.

Or: detect scroll-mode by inspecting the footer (every nav-section URL starts with `#` → infer scroll). Heuristic but practical. Default `auto` runs the heuristic on first read; operator's explicit choice locks it.

### F1 sub-pages interaction

In `scroll` mode, sub-pages are nonsensical (everything's on one URL). The admin sider can still show pages as sections, but the parent/child tree just becomes section-order grouping. `setParent` server validation stays the same; sub-page routing only fires in `multipage`.

## Files to touch

- `shared/types/ISiteFlags.ts` — add `siteMode?: 'scroll' | 'multipage' | 'auto'`.
- `services/features/Seo/SiteFlagsService.ts` — pass-through; no validation beyond enum membership.
- `ui/client/pages/[...slug].tsx` + `ui/client/pages/index.tsx` — branch on mode in `getStaticProps`.
- `ui/client/pages/app.tsx` — render mode-aware (full sections concatenated for scroll; single page for multipage).
- `ui/client/features/Navigation/MainMenu.tsx` — accept mode prop, build `#anchor` items in scroll mode.
- `ui/client/features/Footer/SiteFooter.tsx` — same.
- `ui/admin/features/Seo/SEO.tsx` — add the Select.
- `services/features/Seo/feature.manifest.test.ts` — extend if it asserts the SiteFlags shape.

## Testids — for e2e

- `seo-pane-site-mode-select` — the admin Select on the SEO/client-config pane
- `seo-pane-site-mode-option-{scroll|multipage|auto}` — each option
- `seo-pane-site-mode-warning` — the SEO-impact warning banner shown on switch
- `main-menu-link-{pageSlug}` — every nav item; assert `[href]` shape per mode (`/${slug}` vs `#${anchor}`)
- `site-footer-link-{entryId}` — every footer entry; same per-mode href assertion

E2e coverage:
- `tests/e2e/features/site-mode-toggle.spec.ts` — admin flips mode → public site reload shows nav + footer rebuilt with correct href shape; smooth-scroll fires in scroll mode; deep page paths 404 in scroll mode; F1 sub-pages flatten visibly.

## MCP coverage

`siteFlags.siteMode` is read by `site.featureFlags` (already returns the full `ISiteFlags` shape) and written by `site.setFeatureFlag('siteMode', 'scroll' | 'multipage' | 'auto')` (already accepts arbitrary keys via the generic flag tool). No new MCP tool needed.

Required updates:
- `services/features/Mcp/tools/site.ts` — extend `site.setFeatureFlag` description to mention `siteMode` as a known flag with its enum values.
- `services/features/Seo/SiteFlagsService.ts` validates the enum membership server-side so MCP-driven writes can't poison the flag.

Docs follow-up:
- `docs/architecture/site-flags.md` (or equivalent) — document `siteMode` alongside existing flags.
- `docs/runbooks/site-mode-switch.md` (new) — operator runbook covering the cache-bust + sitemap-regen + external-link-breakage warning when flipping mode under live traffic.

## Acceptance

- New site (no `siteMode` set) defaults to `auto` → `multipage` (F1 behavior, no surprise regression).
- Operator picks `scroll` → root `/` renders every page's sections concatenated, nav builds hash-anchors, smooth-scroll works.
- Operator picks `multipage` → existing F1 behavior unchanged.
- Bundle-import compatibility: existing scroll-era bundles can be set to `scroll` post-import; the existing `#anchor` footer URLs render correctly without bundle patching.
- Tests:
  - SiteFlags accepts the enum value.
  - `app.tsx` renders multi-section concat in scroll mode (mocked siteFlags).
  - Nav + footer build the right href shape in each mode.

## Risks / notes

- **Mode switch under live traffic** flips every URL on the public site. Document in the runbook: changing mode = cache bust + sitemap regen + external-link breakage warning.
- **Sub-pages in scroll mode** lose their meaning. Document: scroll-mode sites stay flat (no parent/child). If the operator has sub-pages and switches to scroll, sub-pages get flattened to top-level sections.
- **SEO impact**: scroll mode = single canonical URL. multipage = N canonical URLs. Switching collapses or expands the indexed surface. Surface in the admin warning when mode changes.

## Effort

**M · ~2h AI, shipped as one chunk.** Everything below lands together — flag + admin Select + nav/footer mode-aware rendering + getStaticProps branch + runbook + tests. There's no useful intermediate state (a flag without rendering branches doesn't change behavior; a footer that emits `#anchor` URLs without scroll-mode routing breaks navigation).

Internal time-share: flag + admin select ~30 min, app.tsx + catch-all branch ~30 min, MainMenu + SiteFooter mode prop + smooth-scroll wiring ~20 min, tests + runbook + acceptance ~40 min.

(Pre-AI human estimate was 1-2 days.)

## Dependency notes

- Builds on F1 (sub-pages). Doesn't depend on F2 (data integrity) or F5 (diagnostics).
- Composes with C9 cache versioning: a mode flip should bump every page's cache key (mode is global, all routes affected).

## Open questions

1. **`auto` heuristic** — page-count threshold or footer-URL inspection? Recommend: default to `multipage` always (no auto-detection — explicit operator choice). Avoids brittle heuristics.
2. **Backwards-compat default for existing sites without the flag** — `multipage` (current behavior) or `scroll` (legacy)? Recommend `multipage` — every site that already runs in production today is in multipage mode (F1 is the live shape). Existing scroll-era bundles that flip to `scroll` will work after the flag lands.
3. **Sub-page handling in scroll mode** — flatten to top-level sections (lose hierarchy) or render the parent + children as one block? Recommend flatten — scroll mode is a flat narrative by nature.
