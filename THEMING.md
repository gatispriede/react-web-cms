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
- `src/frontend/theme/applyThemeCssVars.ts` — sets `--theme-colorPrimary`, `--theme-colorBgBase`, `--theme-colorTextBase`, `--theme-colorSuccess/Warning/Error/Info`, `--theme-borderRadius`, `--theme-fontSize` on `document.documentElement`. Also `resetThemeCssVars()` to clear them.
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

## Adding a new themable token

1. Extend `IThemeTokens` in `src/Interfaces/ITheme.ts`.
2. Add the token to `ThemeService.ts` preset seeds.
3. Add the mapping in `applyThemeCssVars.ts` (pick a `--theme-*` name).
4. Reference it from the relevant module SCSS.
5. Surface a control in `AdminSettings/Theme.tsx` (ColorPicker or InputNumber).

## Do not

- Do **not** wrap admin chrome in the active-theme `ConfigProvider`. This is what caused the "+" button and edit controls to disappear when a low-contrast theme was active.
- Do **not** set `color` on `body` from `--theme-colorTextBase` at the root level — it leaks into admin status bars / menus and can make text unreadable. Scope to `.dynamic-content`.
- Do **not** read AntD tokens from module SCSS — AntD tokens are JS-only. Always go through `--theme-*`.
