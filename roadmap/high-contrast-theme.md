# High-contrast theme — **Shipped (v1)**

`High contrast` preset registered in [`ThemeService.PRESETS`](../src/Server/ThemeService.ts) (slug `high-contrast`) with white-on-black ink/bg (21:1, well above WCAG AAA), safety-yellow accent (#ffd400, 19.56:1 on black), and 17 px base size. SCSS at [`scss/Themes/HighContrast.scss`](../src/frontend/scss/Themes/HighContrast.scss) layers the non-token rules: persistent 2 px yellow `:focus-visible` outline (overrides any module-level `outline: 0`), 2 px underlined links by default, 2 px rules / dividers / form-field borders, AntD tag fills swapped to solid ink-on-bg pairs, and a `@media (forced-colors: active)` block that surrenders our palette to the OS while preserving structural cues. Documented in [THEMING.md](../THEMING.md#accessibility-themes).

**Deferred (phase 2):**

- Auto-pick via `prefers-contrast: more` / `forced-colors: active` + a `SiteFlags.autoHighContrast` flag — needs new flag, GraphQL field, admin toggle, and client-side detection that overrides `applyThemeCssVars` per visitor.
- Full axe audit pass across home / blog / capability matrix — runtime check we can't automate from a chat session.

## Goal

A11y-grade theme option beyond dark mode: 7:1 ink-on-bg (WCAG AAA body text), visible focus rings, no reliance on color alone for state.

## Design

- New theme preset `high-contrast` following the existing theme-token contract so module-level overrides (Paper/Studio) still slot in.
- Tokens:
  - `--bg`: `#000`
  - `--ink`: `#fff`
  - `--accent`: `#ffd400` (contrast 19.56:1 on black)
  - `--rule`: `#fff`, 2px default
  - `--link`: `#a5f3fc`, underlined by default (never color-only)
  - `--focus-ring`: `2px solid var(--accent)`, offset 2px — applied globally
- Audit every `:hover` / `:focus` / active style in theme SCSS — must not depend on subtle alpha changes.
- System pref wiring: if `prefers-contrast: more` OR `forced-colors: active`, admin can opt in a default "auto high-contrast" flag that picks this theme when the user hasn't explicitly chosen one.
- Dark mode and high-contrast coexist; they're separate theme presets, not stacked toggles.

## Files to touch

- `src/frontend/scss/themes/high-contrast.scss` (new)
- `src/frontend/scss/themes/_tokens.scss` (or nearest) — add token entries
- `ThemeService` / preset list — register
- `src/frontend/components/Admin/Themes/ThemeCard.tsx` — uses the same mini-preview (see `theme-picker-previews.md`)
- `src/Interfaces/ISiteFlags.ts` — optional `autoHighContrast: boolean`
- `THEMING.md` — document the token requirements for a11y themes (min ratios, focus ring)

## Acceptance

- Activate theme → every text block on home, capability matrix, blog list, blog post meets 7:1 contrast (check via DevTools / axe)
- Every interactive element has a visible focus ring; no outline suppression
- Links are distinguishable without color (underline)
- `prefers-contrast: more` in OS settings picks this theme when `autoHighContrast` flag is on
- Existing themes still render correctly — no accidental leakage of high-contrast tokens

## Risks / notes

- Easy to miss a focus-ring suppression deep in antd overrides. Run axe on every page type.
- Accent on pure black can look harsh; `#ffd400` is chosen for contrast, but allow the design to be tuned as long as the contrast ratio stays above 7:1 for body, 4.5:1 for large text.

## Effort

**M · 4–6 h**

- Token + SCSS preset: 1–2 h
- Focus-ring audit + global fix-ups: 1–2 h
- `prefers-contrast` wiring + flag: 1 h
- axe run + fix-ups: 1–2 h
