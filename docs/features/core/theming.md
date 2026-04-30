# Theming

## Overview

Themes are defined as token sets (CSS custom properties). The active theme is stored in `SiteSettings` (`key: 'activeThemeId'`). The public site and admin preview both apply themes via `data-theme-name` attribute scoping — no body class toggle.

## Theme presets

Built-in presets are registered in `ThemeService.PRESETS`. Custom themes can be created in admin → Themes. Each theme doc: `{id, name, custom: boolean, tokens, version}`.

| Token | Purpose |
|---|---|
| `--bg` | Page background |
| `--ink` | Body text colour |
| `--accent` | Brand / CTA colour |
| `--rule` | Divider / border colour and width |
| `--font-display` | Heading font stack |
| `--font-mono` | Monospace / meta font stack |

## Theme picker

Admin → Themes renders a card grid. Each `ThemeCard` contains a `ThemePreviewFrame` — a scaled 240×180 mini-page showing hero, meta strip, body paragraph, rule, and primary button rendered with the theme tokens applied as inline CSS custom properties. Tokens are scoped via `[data-theme-name="…"]` selectors, not toggled globally.

## High-contrast theme

The `high-contrast` preset (slug `high-contrast`) is WCAG AAA compliant:

| Token | Value | Contrast |
|---|---|---|
| `--bg` | `#000` | — |
| `--ink` | `#fff` | 21:1 |
| `--accent` | `#ffd400` | 19.56:1 |

Accessibility extras: persistent 2 px yellow `:focus-visible` outline, 2 px underlined links, 2 px rule/border widths. `@media (forced-colors: active)` surrenders the palette to the OS while preserving structural cues.

## `_document.tsx` server-side theme priming

On every request, `_document.tsx` reads the active theme from `ThemeApi` (30 s cache), sets `data-theme-name` on `<body>`, and injects the token map as a `<style>` block — so the page arrives with the correct theme applied before any JS runs, preventing a flash of unstyled content.

## Font picker

Google Fonts integration is a separate feature — see [`google-fonts.md`](google-fonts.md). Fonts selected there are baked into the active theme's `--font-display` / `--font-mono` tokens.
