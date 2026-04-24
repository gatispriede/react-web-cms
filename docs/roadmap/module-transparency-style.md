# Transparency — cross-cutting style option

**Status:** **Shipped (2026-04-24).** `transparent?: boolean` on `shared/types/ISection.ts`;
`.is-transparent` applied by `ui/client/lib/SectionContent.tsx`; modifier rule in
`ui/client/styles/globals/global.scss`; admin toggle (AntD `Switch`) with optimistic
save + undo + contrast-warning icon wired in `ui/client/lib/DynamicTabsContent.tsx`.
tsc 0/0, 136/136 vitest.

## Goal

Add a "transparent background" toggle available on every module, so a section
can sit over a hero image / page background without its default card bg
breaking the visual. Today each module bakes in its own `background` in SCSS
and the only escape hatch is custom CSS per client.

## Design

### Single field, enforced globally

Every section's base data type already extends a shared `ISectionBase`
(spacing, padding, style). Add:

```ts
transparent?: boolean;  // default false
```

Renderer applies a `.is-transparent` modifier class on the section root. One
SCSS rule in `scss/global.scss` (or a shared `_section-modifiers.scss`):

```scss
.section.is-transparent,
.section.is-transparent > .section__inner {
  background: transparent !important;
  box-shadow: none;
  backdrop-filter: none;
}
```

`!important` is intentional — the point is to override whatever each section
set by default. Scope is narrow (only `.is-transparent`), so this isn't the
specificity-war antipattern.

### Admin UI

Under the section's **Style** group in the editor, add a single checkbox:
"Transparent background". No per-module implementation — it's controlled
entirely by the shared renderer + shared SCSS.

### Interaction with themes

A transparent section inherits whatever is behind it: page background, PlainImage
used as bg, or a theme's body colour. No theme-specific handling needed.

### Interaction with Logo transparency

[logo-style-options.md](logo-style-options.md) originally enumerated
`Transparent` as a Logo variant. That duplication is avoided here — Logo uses
the generic `transparent` flag like any other module. Logo's own style enum
stays focused on framing / bordering / clipping treatments.

### Edge cases

- Section with a parallax or video background: `.is-transparent` clears the
  section's own background; the media behind it still renders.
- Sticky / fixed child elements: unaffected — modifier touches only the
  section's bg chain, not child positioning.
- Contrast: if text becomes unreadable over the new backdrop, that's an
  editor decision. Surface a small warning in the admin preview when
  `transparent && has body text` ("Check text contrast against background").

## Files to touch

- `shared/types/ISectionBase.ts` (or equivalent shared section interface)
  — add `transparent?: boolean`
- `ui/client/lib/Sections/SectionRenderer.tsx` — apply class
- `ui/client/styles/global.scss` or new `_section-modifiers.scss` — the
  `.is-transparent` rule
- `ui/admin/modules/InputSectionStyle.tsx` (or
  wherever style-group lives) — checkbox

## Acceptance

- Toggling the flag on any section type hides its bg without layout shift
- Works across all existing sections (Gallery, PlainImage, Logo, Text, etc.)
  without per-section edits
- Saves + reflects on public page after admin save
- Contrast warning appears in admin preview when transparent section has
  foreground text
- No regression for sections that don't toggle it (default `false`)

## Depends on / pairs with

- [logo-style-options.md](logo-style-options.md) — defers transparency to this
  item.
- [themes-as-files.md](themes-as-files.md) — no direct dep, but transparent
  sections put more visual weight on theme bg tokens; worth eyeballing across
  all four presets.

## Effort

**S** — 1–3 h. Interface field + renderer class + one SCSS rule + admin
checkbox + contrast-warning nicety. Broad smoke-test across every section
type is the bulk of the work.
