# Themes as repo files

**Status:** **Shipped (2026-04-24).** Four editorial presets (Paper, Studio, Industrial, High contrast) now live as JSON in `ui/client/themes/`; `ThemeService` seeds missing rows from disk on boot and the admin Theme editor exposes a "Reset to preset" button that overwrites the DB row with on-disk values.

## Goal

Treat presets as source-controlled artefacts: each theme lives in the repo as a
JSON file (and paired SCSS), loaded into the DB on boot if missing. Edits in
the Theme editor stay DB-only (per-site overrides), but the canonical defaults
are in git.

Today the SCSS files at `ui/client/styles/Themes/{Paper,Studio,Industrial,HighContrast}.scss`
describe the *look*, but the matching token values (`colorPrimary`, `fontSize`,
`contentPadding`, etc.) are seeded ad-hoc via `ThemeService` — not diffable, not
reviewable, and a fresh droplet has to re-derive them.

## Design

- Add `ui/client/themes/<slug>.json` — one per preset, matching `IThemeTokens`
  ([ITheme.ts:41-50](../shared/types/ITheme.ts)). Start by exporting the four
  existing presets from their current in-code defaults.
- `ThemeService.bootstrap()` reads the folder on boot: for each file, if no DB
  row with that `id` exists, insert it. Existing rows are left alone (users may
  have edited them).
- Add a `themeSlug` → SCSS file mapping so the editor's "Apply preset" action
  in the admin UI can swap both the tokens *and* the SCSS class on `<body>`.
- Optionally add `npm run sync-themes` to write current DB docs back to JSON —
  round-trips for committing a theme you designed live in the editor.

## Files to touch

- `services/ThemeService.ts` — `bootstrap()` loader
- `ui/client/themes/{paper,studio,industrial,high-contrast}.json` — new
- `shared/types/ITheme.ts` — no change expected; validate current shape covers every token used in SCSS
- `ui/admin/features/Theme/*` — add "Reset to preset" button that re-reads from file
- Optional: `Scripts/syncThemes.ts`

## Acceptance

- Fresh DB boots with all four presets populated from JSON
- Deleting a preset row, restarting, and seeing it re-seeded works
- Existing edited themes are preserved across restarts
- `git diff` on a theme JSON shows human-readable token changes, not opaque
  Mongo dumps

## Effort

**M** — 0.5–1 day. Loader + four JSON files + small admin UI touch + smoke test.
