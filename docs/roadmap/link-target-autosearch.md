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

- `services/anchors/AnchorRegistry.ts` — new; build + cache the anchor list
- `ui/admin/lib/LinkTargetPicker.tsx` — new shared component
- `ui/admin/modules/Hero/HeroEditor.tsx`, `ProjectCard/...Editor.tsx`, `Gallery/...Editor.tsx`, etc. — swap text inputs for `<LinkTargetPicker>`
- `ui/client/lib/DynamicTabsContent.tsx` — already carries `id={section.id}`
- `ui/client/modules/*/Module.tsx` — title elements get `id={slugify(title)}` (one-line each, ~10 modules)
- `ui/client/pages/app.tsx` — tabs-mode hash listener (mount + `hashchange`)
- `scripts/buildCvBundle.cjs` — emit the anchor registry alongside the bundle for SSG consumers

## Acceptance

- [ ] In any link input, typing "career" surfaces the Career section across both pages
- [ ] Selecting an option saves the canonical href; switching layoutMode keeps the link working
- [ ] Tabs-mode: visiting `/#career-record` opens the right tab and scrolls to the title
- [ ] Scroll-mode: visiting `/cms#career-record` scrolls to the title with `scrollMarginTop: 80`
- [ ] Renaming a module title regenerates the anchor; the picker shows the new label; the old href degrades gracefully (resolver tries the slug, falls back to the section)
- [ ] No schema migration required — saved JSON still uses `{href: '/cms#career-record'}`

## Effort

**M (0.5–1 day)** for the picker + module-title ids + hash listener.
**+S (1–3 h)** for the registry build/cache hook on save.
**+S** per editor surface to swap the input (≈8 surfaces).

Total: **~2 focused days** including a test pass.
