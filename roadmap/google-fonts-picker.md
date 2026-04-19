# Google Fonts picker — **Shipped (v1)**

[`AdminSettings/FontPicker.tsx`](../src/frontend/components/Admin/AdminSettings/FontPicker.tsx) browses a hand-curated 58-family catalogue at [`src/frontend/data/google-fonts.json`](../src/frontend/data/google-fonts.json) (popular families across sans / serif / display / handwriting / monospace, Cyrillic-capable where Google publishes it). The picker writes a CSS font-family stack with category-appropriate fallbacks back to `fontDisplay` / `fontSans` / `fontMono` tokens.

[`_document.tsx`](../src/frontend/pages/_document.tsx) extracts the active theme's family names via `extractFontFamily()`, dedupes against a `BUNDLED_FAMILIES` list (the seeded Paper / Studio / Industrial fonts kept loaded site-wide so theme switches don't FOUC), and composes a single `<link>` URL via `buildGoogleFontsUrl()` — variants come from each catalogue entry so we don't request weights a family doesn't ship.

**Deferred (phase 2 / nice-to-have):**

- `Scripts/update-google-fonts.ts` to rebuild the snapshot from the Developer API on a quarterly cadence (today's catalogue is hand-maintained).
- Self-hosted `@fontsource` variant for GDPR-clean operation (today fonts load from `fonts.googleapis.com`, embedding visitor IPs).
- Picker UI cap of 3 weight variants per family — currently we request whatever the catalogue entry lists (already minimal).

## Goal

Admin can pick any Google Font for the `display` and `body` (and optionally `mono`) font slots from an in-app browser, preview it live, and activate without hand-editing SCSS or the theme JSON.

## Design

### Catalogue

- Use the official Google Fonts Developer API (requires API key) OR ship a snapshot of the metadata JSON (`fonts.json`) updated periodically. Snapshot avoids the runtime key; acceptable since the list moves slowly.
- Store snapshot at `src/frontend/data/google-fonts.json`, ~1200 entries. Fields kept: `family`, `category` (`serif` / `sans-serif` / `display` / `handwriting` / `monospace`), `variants`, `subsets`.

### Picker UI

- Admin → Theme → new "Fonts" sub-tab, alongside the existing Theme cards
- Two (or three) font slots: Display, Body, Mono (optional)
- Each slot: searchable combobox with category filter + subset filter (Latin / Latin-ext / Cyrillic for `lv` locale)
- Live preview pane renders a hero headline + paragraph + code block using the selected fonts, refreshes on selection
- Save writes to the active theme's `fonts` object; `refreshBus.emit('settings')` triggers a re-render

### Loading

- On save, add a `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link href="https://fonts.googleapis.com/css2?family=…&display=swap" rel="stylesheet">` to `_document.tsx`'s head
- Include only the variants actually used (default: 400, 700, 400-italic) to keep LCP down
- Theme-scoped CSS vars: `--font-display`, `--font-body`, `--font-mono` already exist — the save action just writes new values into them

### Self-hosted option (optional, phase 2)

- Download chosen families on save via `@fontsource`-style fetch to `public/fonts/{family}/` and serve local CSS. Makes the site offline-friendly and avoids Google analytics cookies but needs a disk-write pipeline.
- Decide later — for v1 ship with the CDN link tags.

## Files to touch

- `src/frontend/data/google-fonts.json` (new, snapshot)
- `src/frontend/components/Admin/Themes/FontPicker.tsx` (new)
- `src/frontend/components/Admin/Themes/ThemeTab.tsx` — add the Fonts sub-tab
- `src/Interfaces/ITheme.ts` — `fonts: {display?: string; body?: string; mono?: string; variants?: string[]}`
- `ThemeService` — persist the new field
- `src/frontend/pages/_document.tsx` — pull the fonts config from theme, render `<link>` tags
- `Scripts/update-google-fonts.ts` (new) — rebuilds the snapshot from the Developer API; run quarterly

## Acceptance

- Picker loads the catalogue in under 500 ms (snapshot is local)
- Selecting a font updates the preview pane immediately; saving propagates to the public site
- Public-site LCP does not regress by more than 100 ms vs the current system-font baseline (variants kept minimal)
- Cyrillic glyphs render correctly when `lv` → `ru` or similar locale extensions are enabled
- Reverting a theme preset restores its bundled fonts without manual clear

## Risks / notes

- Privacy: embedding Google Fonts sends the visitor's IP to Google. If GDPR review flags this, we fall back to self-hosted (phase 2 work).
- Don't let editors pick 8 weight variants — cap at 3 per family in the picker UI.

## Effort

**M · 5–7 h**

- Snapshot ingestion + data file: 1 h
- FontPicker component with search / filter / live preview: 2–3 h
- Save + theme schema changes + link-tag injection: 1–2 h
- Quarterly-update script: 1 h
- Testing across themes + locales: 1 h
