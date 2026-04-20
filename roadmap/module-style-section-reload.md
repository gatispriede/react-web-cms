# Modules respect style section + live-reload preview on change

**Status:** Partial (2026-04-20). Sub-bug 1 (modules without base styles when theme doesn't own them) resolved for Services, Testimonials, ProjectGrid, Manifesto, StatsCard — see [services-theme-fallback-style.md](services-theme-fallback-style.md). Remaining:
- Audit that each module reads `item.style` and actually flips its rendered class/variant — today several modules accept the style but the CSS doesn't change.
- Preview reactivity: editing a content field should update the preview within one render frame.

## Goal

Every module reads and applies its "style" section (alignment, spacing, variant, colour pair, etc.) and the live preview updates immediately when any style or content field changes — no manual reload, no stale preview.

## Design

Two related bugs:

1. **Style section ignored.** Many new modules render without consulting their own `style` config — they use hardcoded class names or inline styles. Audit each module; ensure the component receives `style` props and maps them to the same class-name contract older modules use (e.g. `align--left`, `pad--lg`, `variant--card`).
2. **Preview not reactive.** Editing a field in admin doesn't push the new state into the preview surface. Likely the preview component is memoised on a stable key, or the admin store isn't emitting on nested-field changes. Check: field change → store update → preview re-render.

## Files to touch

- All section components under `components/Sections/*` — audit style-consumption
- Preview component (wherever the admin embeds the rendered page)
- Admin state store / form plumbing — verify nested field changes trigger re-render
- Per-section SCSS — confirm style class names are defined for new modules

## Acceptance

- Every module exposes style tokens that visibly affect its render
- Editing any field (content or style) updates the preview within one render frame
- No "refresh to see change" moments in admin

## Effort

**M · 0.5–1 day** (touches many modules)
