# Editorial — design doc (placeholder)

**Status:** placeholder. Wave 5 infrastructure jump shipped the slot; real visual design lands in a follow-up jump from Stitch frames.

## Target audience

Writers, photographers, journalism. Single-author voice; reading-first.

## Mood

Quiet, considered, literary, spacious.

## When to pick this

Long-form text. Photo essays. Author-led blog. Journalism-style site.

## When NOT to pick this

Product shops (use `commerce`). Agency case studies (use `agency`). Booking-led sites (`restaurant` / `local-business`).

## Design elements (target — placeholder values shipped)

- Display: serif (currently system serif — final pass to specify Instrument Serif / similar)
- Body: system sans (final pass: humanist sans)
- Motion: gentle-slow — 400ms base, standard cubic-bezier(0.2, 0, 0, 1)
- Header: hide-on-down / show-on-up (Headroom — Medium pattern)
- Footer: minimal 1-row

## Stitch frames

_Slot — populate `theme.json#stitchFramesUrl` when the design pass lands._

## Implementation slots

- `theme.json` — manifest values (light + dark palette, fonts, motion, hints)
- `theme.scss` — semantic-token overrides scoped under `[data-theme-name="editorial"]`
- `module-styles.scss` — per-module override layer (empty placeholder)
