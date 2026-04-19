# Theme picker — visual previews — **Shipped**

`ThemePreviewFrame` renders a scaled mini page (hero + mono meta strip + body paragraph + rule + primary button) inside each `ThemeCard` in [AdminSettings/Theme.tsx](../src/frontend/components/Admin/AdminSettings/Theme.tsx). Tokens are passed as inline CSS custom properties on a wrapper carrying `data-theme-name={slug}`. All editorial theme SCSS files (Paper / Studio / Industrial) use ancestor-agnostic `[data-theme-name="…"]` selectors so module overrides render the same inside the preview as on the live site. Scoping contract documented in [THEMING.md](../THEMING.md).

## Goal

Admin → Theme card shows a real-looking mini page rendered with that theme's tokens, so editors can tell Paper from Studio at a glance instead of decoding a color-swatch row.

## Design

- Each card renders a self-contained "page in miniature" in a ~240×180 frame.
- Mini page covers: hero headline + meta strip + primary button + body paragraph + rule separator. That hits bg, ink, accent, rule, display + mono fonts.
- Theme tokens applied via a scoped CSS-variable wrapper keyed on `data-theme-name`, NOT by toggling body class. Prevents cards from stomping each other (or the current site) while previewing.
- SCSS theme-scope rules must target `[data-theme-name="paper"] …` selectors so module-level overrides (Paper / Studio) work inside the preview the same way they work on the site.
- Preview is static, not interactive; hover raises card, click activates theme (existing behaviour).

## Files to touch

- `src/frontend/components/Admin/Themes/ThemeCard.tsx` — render the mini page inside each card
- `src/frontend/scss/themes/*.scss` — audit every theme selector, ensure it works under `[data-theme-name]` scope rather than body class
- `src/frontend/components/Admin/Themes/ThemePreviewFrame.tsx` (new) — the mini page component, fixed size, cropped content
- `THEMING.md` — document the `[data-theme-name]` scoping contract so new themes comply

## Acceptance

- Classic / Ocean / Forest / Midnight color-only presets render with correct bg + ink + accent
- Paper / Studio editorial themes render module-level overrides (heading font family, rule style, button treatment) exactly as they appear on a real section
- Activating a theme from a card matches what the preview showed — no "looked different in the card"
- Switching cards does not flash the site with a different theme — scoping is tight

## Risks / notes

- Biggest risk is SCSS selectors that only work under `body.theme-x`. The audit is the bulk of the work; budget accordingly.
- Don't try to preview blog / gallery modules in the mini — too much layout to cram. Hero + meta + button is enough signal.

## Effort

**M · 4–6 h**

- ThemePreviewFrame component: 1 h
- SCSS selector audit + refactor to `[data-theme-name]`: 2–3 h
- Wiring into ThemeCard: 30 min
- Cross-check every theme activates correctly after refactor: 1 h
- Docs: 30 min
