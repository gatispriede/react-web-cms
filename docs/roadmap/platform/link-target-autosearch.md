# Link target autosearch (anchors + page picker)

## Goal

Stop making content authors guess at link strings. Wherever a module exposes a "link" or "internal link" field — Hero CTAs, ProjectCard `href`, ProjectGrid items, Gallery tiles, List items, RichText link runs, NavBar links, Footer links — replace the bare text input with an **autosearch dropdown** that surfaces the real targets the site offers:

- every published page (`/cms`, `/lss`, …) — slug-aware in scroll mode, hash-aware in tabs mode
- every section anchor (e.g. `#cv-sec-home-career`)
- every **module-with-a-title** anchor — when an authored module renders an `h2` / `h3` with a title, the saved title becomes a stable anchor (`#career-record`)
- external URL fallback (free-text accepted, validated as URL)

## Why now

- Authors are typing literal strings like `#career` and `/cms` and they sometimes go nowhere — the renderer happens to ignore mistakes silently.
- Tabs-mode anchor linking just landed; without an authoring picker, only the dev who wired it knows which anchors exist.
- 2026-04 client review repeatedly flagged "where do I link to" friction across Hero, Services, ProjectGrid.

## Design

### 1. Anchor registry

When a section / module saves, the publish pipeline (`buildCvBundle.cjs` for the CV bundle, the same hook on Mongo writes for live edits) computes:

- `sectionAnchor`: the section's `id` (already deterministic from save).
- `titleAnchor`: if the module's content JSON has a `title` (or `sectionTitle`), slugify it → `career-record`. Resolves collisions by appending `-2`, `-3`, …
- `pageHref`: depends on `siteFlags.layoutMode` —
  - `scroll`: `/<page-slug>#<anchor>`
  - `tabs`: `/#<anchor>` (single-page; the in-page hash listener switches the tab containing the anchor — see DynamicTabsContent + app.tsx).

These get written to a small `anchors` collection / cached doc keyed by `{page, sectionId, itemIndex?}` so the picker can read them with one fetch. The doc is invalidated on any section save.

### 2. Authoring picker

A reusable `<LinkTargetPicker value onChange>` AntD `Select` with:

- async options grouped by **Page → Section → Module title**
- search across labels (page name, section title, module title)
- a final "Custom URL…" entry that flips the control to a plain `<Input>` accepting `http(s)://` or `mailto:`
- the resolved option emits the **canonical href string** so the saved JSON keeps the same shape it has today (no module schema migration)

Wired into:

- Hero ctaPrimary / ctaSecondary / ctaTertiary
- ProjectCard.href / ProjectGrid item.href
- Gallery tile.href, Carousel slide.href
- List item.href, RichText link runs
- Footer + Logo logoLinkUrl
- NavBar custom links

### 3. Deep-link behaviour

Already shipping (this PR):

- Section wrapper carries `id={section.id}`
- Module titles render `id={slugify(title)}`
- Tabs-mode `app.tsx` listens for `hashchange`, resolves the hash → owning tab → `setState({activeTab})`, then `scrollIntoView({block:'start'})` after the tab paints.

### 4. Site-setting dependency

`siteFlags.layoutMode` decides whether the picker emits `/page#anchor` (scroll) or `/#anchor` (tabs). Switching the mode at runtime triggers a one-shot re-render of saved hrefs in the picker preview (not in stored data — stored hrefs stay shape-stable, the renderer normalises at read time).

## Files to touch

- `services/features/Anchors/AnchorRegistry.ts` — new feature slice; build + cache the anchor list. Co-located with its tests (`AnchorRegistry.test.ts`) and `feature.manifest.ts`. Lives under `services/features/<Name>/` per `target-architecture.md` — every server-side feature is a deletable folder unit; no `services/anchors/` parallel hierarchy.
- `ui/admin/lib/LinkTargetPicker.tsx` — new shared component
- `ui/admin/modules/Hero/HeroEditor.tsx`, `ProjectCard/...Editor.tsx`, `Gallery/...Editor.tsx`, etc. — swap text inputs for `<LinkTargetPicker>`
- `ui/client/lib/DynamicTabsContent.tsx` — already carries `id={section.id}`
- `ui/client/modules/*/Module.tsx` — title elements get `id={slugify(title)}` (one-line each, ~10 modules)
- `ui/client/pages/app.tsx` — tabs-mode hash listener (mount + `hashchange`)
- `scripts/buildCvBundle.cjs` — emit the anchor registry alongside the bundle for SSG consumers

## Testids — for e2e

The picker is a reusable AntD Select wrapper used in 8+ editors; testids are critical so e2e specs can target it from any host editor.

Picker surface (`<LinkTargetPicker>`):
- `link-target-picker-{hostId}` — picker root; `hostId` is the editor field id (e.g. `hero-cta-primary`, `project-card-{projectId}-href`)
- `link-target-picker-{hostId}-input` — the search input
- `link-target-picker-{hostId}-option-{anchorId}` — each surfaced option in the dropdown
- `link-target-picker-{hostId}-group-{Page|Section|Module|Custom}` — option group headers
- `link-target-picker-{hostId}-custom-toggle` — "Custom URL…" entry that flips to free-text mode
- `link-target-picker-{hostId}-custom-input` — the free-text URL input when active

Public-side anchor targets:
- `section-anchor-{sectionId}` — already implicit via `id={section.id}` on the section wrapper; mirror as `data-testid` for e2e too
- `module-title-anchor-{slug}` — module titles that emit anchor ids

E2e coverage:
- `tests/e2e/admin/link-target-picker.spec.ts` — type "career" → assert grouped results → select an option → saved href matches expected canonical shape (per layoutMode); switching layoutMode keeps the link working.
- `tests/e2e/features/anchor-deeplink.spec.ts` — visit `/cms#career-record` → smooth-scroll to title with correct `scrollMarginTop`; tabs-mode `/#career-record` → opens correct tab + scrolls.

## MCP coverage

The picker is the human authoring surface; the agent authoring surface needs the same registry exposed as MCP tools so an AI building a hero CTA picks a real link target instead of guessing.

Two new tools in `services/features/Mcp/tools/anchors.ts`:

| Tool | Scope | Description |
|------|-------|-------------|
| `anchor.list` | `read:content` | Returns the full anchor registry — every page, section, and module-with-a-title across the site. Optional `siteMode` filter ('scroll' \| 'multipage') controls href shape. Used before `section.update` to validate any link-bearing content. |
| `anchor.search { query }` | `read:content` | Free-text search across page names, section titles, and module titles. Returns ranked matches with their canonical hrefs. Mirrors the picker's autosearch UX for agents. |

No write tool — the registry is derived from existing collections (Navigation, Sections), not its own collection. Authoring a new anchor = creating a page / section / module with a title; that already goes through the existing write tools.

The `LinkTargetPicker` component and the new MCP tools both consume the same `AnchorRegistry` — single source of truth.

Docs follow-up:
- `docs/architecture/anchors.md` (new) — registry shape, slugify rules, scroll-vs-multipage href shape.
- Update `docs/roadmap/mcp-real-world-ready.md` tool count (89 → 91).

## Acceptance

- [ ] In any link input, typing "career" surfaces the Career section across both pages
- [ ] Selecting an option saves the canonical href; switching layoutMode keeps the link working
- [ ] Tabs-mode: visiting `/#career-record` opens the right tab and scrolls to the title
- [ ] Scroll-mode: visiting `/cms#career-record` scrolls to the title with `scrollMarginTop: 80`
- [ ] Renaming a module title regenerates the anchor; the picker shows the new label; the old href degrades gracefully (resolver tries the slug, falls back to the section)
- [ ] No schema migration required — saved JSON still uses `{href: '/cms#career-record'}`

## Effort

**M · ~3h AI, shipped as one chunk.** Picker component, registry build/cache hook, MCP tools, every editor surface swap (~8 editors), hashchange listener, module-title `id` emission, and tests all land together. A picker without the registry behind it is a dropdown of nothing; a registry without picker integration in editors is dead infrastructure; missing one editor swap means an inconsistent authoring experience. Land together.

Internal time-share: registry + cache hook ~30 min, picker component + types ~30 min, editor surface swaps (8 × ~5 min mechanical via shared component) ~40 min, MCP tools (`anchor.list`, `anchor.search`) ~20 min, module-title id + hashchange listener ~20 min, tests + runbook ~40 min.

(Pre-AI human estimate was ~2 focused days.)
