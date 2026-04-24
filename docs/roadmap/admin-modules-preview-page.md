# Admin modules-preview page — style matrix + theme switcher

## Goal

A single admin-only page that renders **every module** in **every style variant**
with realistic sample content, plus a **theme switcher** at the top so the whole
matrix can be flipped between all available themes. Used to catch regressions
when we add a new style or tweak a theme — today we only find breakage by
clicking through real pages.

Current pain point: modules like **Hero** look fine under the default theme, but
breaks on certain themes (e.g. text padding collapses). There's no systematic
way to eyeball that before shipping a theme change.

## Design

### Route & access

- New page: `ui/client/pages/admin/modules-preview.tsx` (admin-gated, same auth
  check as other `/admin/*` pages).
- Linked from the admin sidebar under a new **Diagnostics** (or **Style matrix**)
  entry.

### Page layout

```
┌─────────────────────────────────────────────────────────┐
│ [Theme ▾]  [Transparent bg ☐]  [Responsive ▾]           │  ← sticky toolbar
├─────────────────────────────────────────────────────────┤
│ Hero                                                     │
│   ├── default style                                      │
│   ├── variant: centered                                  │
│   └── variant: with-image                                │
│ PlainImage                                               │
│   ├── …                                                  │
│ Logo                                                     │
│   ├── Bordered / Framed / Circle (C7) …                  │
│ …                                                        │
└─────────────────────────────────────────────────────────┘
```

- Toolbar is `position: sticky; top: 0` so switching theme while scrolled keeps
  context.
- Each module renders inside a labelled frame showing its name + variant.
- Clicking a frame opens a fullscreen view of just that variant (helps isolate
  regressions).

### Theme switching

- Dropdown lists every theme from the `themes-as-files.md` registry (C1) — when
  C1 ships, this page reads the same source of truth. Until then, pull from
  whatever the current theme seed is.
- Switching **swaps `<html data-theme="…">`** client-side — no page reload. The
  entire matrix re-styles instantly; this is the whole point of the page.
- Also expose the **transparent** flag (C8) as a global toggle so we can verify
  transparency behaviour per theme per module.

### Sample content

Colocate a `ui/client/lib/preview/samples.ts` map:

```ts
export const sampleSections: Record<EItemType, ISection[]> = {
  [EItemType.Hero]: [
    { /* default */ },
    { /* with background image */ },
    { /* centered short copy */ },
  ],
  [EItemType.RichText]: [ … ],
  [EItemType.Logo]: [ /* each C7 variant */ ],
  …
};
```

- Fixtures are pure data — no DB round-trip. Page renders via the same
  `SectionContent` / `DynamicTabsContent` (read-only mode) the public site uses,
  so what you see is exactly what visitors see.
- When a new module or style lands, the expectation is: add a fixture here.
  Add a lint/test that fails if `EItemType` gains a member with no sample.

### Style variants enumeration

Modules that already have variants (Logo after C7, Gallery after C6, etc.) expose
them via a `styleVariants` export. The preview page iterates those. Modules
without variants render once (default).

## Files to touch

- `ui/client/pages/admin/modules-preview.tsx` — page entry
- `ui/client/lib/preview/ModulesPreview.tsx` — rendering component
- `ui/client/lib/preview/samples.ts` — fixture map
- `ui/client/lib/preview/ThemeSwitcher.tsx` — dropdown that writes
  `document.documentElement.dataset.theme`
- `ui/admin/shell/AdminSidebar.tsx` (or equivalent) — link to `/admin/modules-preview`
- `ui/client/lib/preview/samples.test.ts` — asserts every `EItemType` has ≥1 sample

## Acceptance

- `/admin/modules-preview` renders every module with every declared style variant
- Theme dropdown switches **all** visible modules instantly, no reload
- Transparent toggle flips `.is-transparent` across the whole matrix
- Adding a new `EItemType` without a sample fails a test (guard-rail)
- Known regression is reproducible from the page — e.g. open Hero under theme X,
  see the padding break; fix the theme or module; regression no longer visible
- Admin-only (non-admin visit returns the normal 403/redirect path)

## Depends on / pairs with

- [themes-as-files.md](themes-as-files.md) (C1) — dropdown is populated from the
  shipped theme registry. Can ship before C1 by hardcoding the current list, then
  rewire.
- [logo-style-options.md](logo-style-options.md) (C7) — first consumer of
  `styleVariants` contract.
- [gallery-improvements.md](gallery-improvements.md) (C6) — each gallery layout
  variant appears in the matrix.
- [module-transparency-style.md](module-transparency-style.md) (C8, shipped) —
  the transparent toggle reuses that flag.

## Effort

**M** — 0.5–1 day. Page scaffolding + fixture map for current ~15 modules + theme
switcher + sidebar link + sample-coverage test. Bulk of the time is **writing
realistic sample data** for every module, not code.
