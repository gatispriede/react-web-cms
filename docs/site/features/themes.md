# Themes

The **Themes** pane (`/admin/client-config/themes`) controls colour, typography, spacing, and component tokens for the public site. Multiple themes coexist; one is **active** at a time.

## Built-in presets

- **Classic** — neutral, high contrast, serif headings.
- **Editorial** — magazine-style, dense, mono accents.
- **Mono** — monochrome, minimal.
- **Vivid** — saturated, modern.

Each preset is just a JSON token bag. Duplicate one to make a custom theme without losing the default.

## Tokens

Themes carry an Ant Design–compatible `tokens` object plus extras:

- **Colour** — `colorPrimary`, `colorBgBase`, `colorTextBase`, plus accent and surface roles.
- **Typography** — `fontFamily`, `fontFamilyHeading`, `fontSize` scale, weights.
- **Geometry** — `borderRadius`, `controlHeight`, `padding` scale.
- **Module-level overrides** — per-module style classes referenced by `item.style` (e.g. RichText supports `editorial`, `compact`, `default`).

Tokens hydrate two layers:

- The Ant Design `ConfigProvider` — controls every admin UI control.
- A CSS variable layer — `applyThemeCssVars(tokens)` writes to `:root` so module SCSS can reference them.

## Switching theme

Pick from the dropdown → click **Set active**. The site re-renders without a reload; ISR refresh fires for the home page.

## Fonts

The Font Picker (`/admin/client-config/themes` → Fonts tab) lists Google Fonts via the cached manifest at `tools/scripts/update-google-fonts.ts`. Run that script to refresh the list; it reads the public Google Fonts API and writes a static manifest used at runtime.
