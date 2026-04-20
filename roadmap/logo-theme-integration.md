# Logo integration across themes

**Status:** Queued.

## Goal

The site logo feels visually bolted-on in every theme, most painfully in the single-page layout. After this lands, logo rendering respects each theme's tokens (spacing, ink colour, stroke, scale) and the single-page hero integrates it as a first-class element instead of floating it awkwardly above the hero.

## Design

- Add per-theme logo slot rules: max-height, colour-mode (ink / accent / reversed), padding, and whether it sits inline with nav or as a standalone mark.
- Introduce `--logo-size`, `--logo-ink`, `--logo-gap` tokens in `_tokens.scss`; every theme overrides as needed (Paper = small inline, Studio = larger standalone, HighContrast = reversed ink).
- Single-page layout: logo participates in the hero stack (above title, below nav) with theme-driven spacing — not absolutely positioned.
- SVG logos should inherit `currentColor` so theme ink applies without duplicated assets.
- Small-screen rules per theme (shrink threshold) so mobile doesn't crush the mark.

## Files to touch

- `src/frontend/scss/Themes/*.scss` — per-theme logo blocks
- `src/frontend/scss/_tokens.scss` — new tokens
- Logo component (likely under `components/common/`) — consume tokens, `currentColor` path
- Single-page layout component — restructure hero so logo is a stack child
- `THEMING.md` — document logo tokens + colour-mode contract

## Acceptance

- Swap through every theme in admin → logo scale/colour/spacing visibly reflects theme intent
- Single-page layout: logo, title, subtitle, CTAs read as one composition, no overlap or visual orphaning
- SVG logo recolours via theme ink token, no hand-edited duplicates
- Mobile (<= 480 px) still shows legible logo in every theme

## Effort

**M · 4–6 h**
