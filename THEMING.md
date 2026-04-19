# Theming — admin chrome vs. module output

The site has two visually distinct surfaces:

1. **Admin chrome** — the editing UI (AdminApp tabs, EditWrapper delete button, AddNewSection "+" card, toolbar icons, modal dialogs, settings forms). Must stay predictable and legible *regardless of which theme a user picked*. A theme with white-on-white or low-contrast tokens cannot be allowed to hide the "+" button or the Edit/Delete controls.
2. **Module output** — the rendered site sections (PlainText, RichText, PlainImage, Gallery, Carousel). These are the user-facing content blocks and **must** reflect the active theme (primary, background, text, radius, font size).

## The boundary

| Surface | AntD tokens | CSS variables (`--theme-*`) |
|---|---|---|
| Admin chrome (AdminApp's `ConfigProvider`) | **Static** — always `themeConfig.ts` | N/A — not referenced by admin SCSS |
| Module output (inside `.dynamic-content`) | Inherits public `ConfigProvider` (active theme) | Applied via `.dynamic-content { … }` scope |
| Public site (`app.tsx`'s `ConfigProvider`) | **Active theme** from `Themes` collection | Applied at `:root` via `applyThemeCssVars` |

## Why two mechanisms (AntD tokens + CSS vars)?

- AntD tokens style AntD components (Button, Tag, Modal, Table). `ConfigProvider` is the only supported lever.
- Module SCSS (`PlainText.scss`, `RichText.scss`, `Gallery.scss`, …) is hand-written CSS. It can't read AntD tokens, so we mirror the theme tokens into `--theme-*` CSS custom properties and reference them from the module stylesheets.

## Code layout

- `src/frontend/theme/themeConfig.ts` — static AntD tokens used by the admin. Never changes at runtime.
- `src/frontend/theme/buildThemeConfig.ts` — converts a persisted `IThemeTokens` into an AntD `ThemeConfig`. Used only on the public surface.
- `src/frontend/theme/applyThemeCssVars.ts` — client-side runtime setter for `--theme-*` custom properties on `document.documentElement`. Also `resetThemeCssVars()` to clear them.
- `src/frontend/theme/themeCssVarsString.ts` — server-side equivalent that emits a `:root { … }` rule body. [_document.tsx](src/frontend/pages/_document.tsx) `getInitialProps` fetches the active theme from Mongo and injects the rule inside a single `<Head>` as `<style data-theme-vars>…</style>` so the **first paint** already has the theme tokens (no flash of default).
- `src/frontend/api/ThemeApi.ts` — 30s in-memory cache on `getActive()`, invalidated on every theme mutation so changes still propagate immediately.
- `src/frontend/scss/base-colors.scss` — declares `--theme-*` fallbacks so un-themed pages still render.
- `src/frontend/scss/global.scss` — theme tokens only bind **inside `.dynamic-content`**; body background does pick up `--theme-colorBgBase` (low-risk; admin chrome sits on top of body).

## Runtime wiring

```
/admin  (AdminApp)
  ├── ConfigProvider theme = themeConfig.ts   ← static; admin chrome unaffected by user theme
  └── DynamicTabsContent
        └── <div class="dynamic-content">
              ├── [section modules]           ← styled by --theme-* via SCSS
              └── AddNewSection (admin-only)  ← AntD Button using static tokens → always visible
```

```
/  (public App)
  ├── ConfigProvider theme = active theme     ← all AntD components themed
  └── applyThemeCssVars(active.tokens)        ← --theme-* set on :root
        └── <div class="dynamic-content">
              └── [section modules]            ← styled by --theme-* via SCSS
```

Both surfaces call `ThemeApi.getActive()` on mount. The difference is what they do with it:
- Admin: apply CSS vars only — so module *previews* inside the editor reflect the theme, but `ConfigProvider` stays on the static admin theme.
- Public: apply CSS vars **and** feed tokens into `ConfigProvider`, so AntD components (menus, dropdowns, language selector) also match.

## Adding a new themable module

1. Add the module's SCSS under `scss/Components/`.
2. Use `var(--theme-colorTextBase, inherit)` for text, `var(--theme-colorPrimary)` for accents, `var(--theme-borderRadius, 0)` for corners.
3. Nest the rules under `.dynamic-content` (already done via `global.scss` — new modules just need to be imported and nested similarly).

## Theme-slug scoping contract (Paper / Studio / Industrial)

Editorial themes that go beyond token values and restyle specific modules (Paper, Studio, Industrial) live at `src/frontend/scss/Themes/<Name>.scss`. Each such file wraps its entire ruleset under `[data-theme-name="<slug>"]`.

**Rules for authors:**

- Use `[data-theme-name="foo"]` — **never** `body[data-theme-name="foo"]`. The `body` ancestor breaks the Theme-picker preview cards, which wrap the mini page in a `<div data-theme-name="foo">` and can't elevate that attribute to body. Selectors without the `body` constraint still match the production body just fine.
- The slug must be the `themeSlug` value on the preset in `ThemeService.PRESETS` and the `themeSlug` field on any custom theme built from it.
- Runtime continues to set `document.body.dataset.themeName = slug` for the public site. Preview cards set the attribute on their own wrapper `<div>`.
- Portal overlays (dropdowns, popovers, etc.) mount under `<body>`, so they still pick up the theme-name scoping in production. Previews don't render portal overlays, so there's nothing to reconcile on that side.

## Adding a new themable token

1. Extend `IThemeTokens` in `src/Interfaces/ITheme.ts`.
2. Add the token to `ThemeService.ts` preset seeds.
3. Add the mapping in `applyThemeCssVars.ts` (pick a `--theme-*` name).
4. Reference it from the relevant module SCSS.
5. Surface a control in `AdminSettings/Theme.tsx` (ColorPicker or InputNumber).

## Accessibility themes

The `High contrast` preset (slug `high-contrast`) targets WCAG AAA (21:1 white-on-black for body, 19.56:1 for the safety-yellow accent). Its SCSS file at [`scss/Themes/HighContrast.scss`](src/frontend/scss/Themes/HighContrast.scss) layers the non-token rules a palette alone cannot deliver:

- Persistent `:focus-visible` outline (2px yellow, 2px offset) overrides any module-level `outline: 0` reset.
- Links underlined by default (2px, 3px offset) — never colour-only state.
- `border-width` bumped to 2px on rules / dividers / form fields so they survive zoom + low-vision rendering.
- AntD tag fills swapped from light tints to solid ink-on-bg pairs.
- `@media (forced-colors: active)` block surrenders our palette to the OS while preserving structural cues (underlines, outline thickness).

When adding a new a11y-graded preset: keep ink/bg above 7:1 (WCAG AAA body), pick a single high-contrast accent that survives on both bg colours used (test with the WebAIM contrast checker), and never rely on hue alone for state — pair colour with shape (underline, border, outline).

**Deferred:** `prefers-contrast: more` / `forced-colors: active` auto-pick via a `SiteFlags.autoHighContrast` flag — see `roadmap/high-contrast-theme.md` for the design.

## Picking fonts (Google Fonts)

[`AdminSettings/FontPicker.tsx`](src/frontend/components/Admin/AdminSettings/FontPicker.tsx) browses a hand-curated catalogue at [`src/frontend/data/google-fonts.json`](src/frontend/data/google-fonts.json) and writes a CSS font-family stack (with category-appropriate fallbacks) back to the `fontDisplay` / `fontSans` / `fontMono` token of the editing theme.

[`_document.tsx`](src/frontend/pages/_document.tsx) reads the **active** theme's font tokens, extracts the leading family name from each stack via `extractFontFamily()`, dedupes against a `BUNDLED_FAMILIES` list (the seeded Paper / Studio / Industrial fonts — kept loaded site-wide so theme switches don't FOUC), and composes a single `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?…">` tag via `buildGoogleFontsUrl()`. Per-family weight requests come from each catalogue entry's `variants` array, so we don't 404 on weights a family doesn't ship.

Adding a family to the catalogue: append an entry to `google-fonts.json` with `{family, category, variants, subsets}`. A future `Scripts/update-google-fonts.ts` will rebuild the file from the Developer API; for now it's a manual list.

**Privacy:** embedding Google Fonts sends visitor IPs to Google. If GDPR review flags this, we fall back to self-hosted via `@fontsource` (deferred — see `roadmap/google-fonts-picker.md`).

## Do not

- Do **not** wrap admin chrome in the active-theme `ConfigProvider`. This is what caused the "+" button and edit controls to disappear when a low-contrast theme was active.
- Do **not** set `color` on `body` from `--theme-colorTextBase` at the root level — it leaks into admin status bars / menus and can make text unreadable. Scope to `.dynamic-content`.
- Do **not** read AntD tokens from module SCSS — AntD tokens are JS-only. Always go through `--theme-*`.
