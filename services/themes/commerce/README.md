# Commerce — design doc (placeholder)

**Status:** placeholder. Wave 5 infrastructure jump shipped the slot; real visual design lands in a follow-up jump from Stitch frames.

## Target audience

Small product shops, makers. Also home of the ss.com cars listing experience.

## Mood

Clean, catalogue-first, tactile, soft.

## When to pick this

Product catalogues. Maker shops. Marketplaces. Anything where the grid IS the page.

## When NOT to pick this

Hospitality (use `restaurant` — menu / reservation, not catalogue). Services-with-contact-CTA (`local-business`).

## Design elements (target — placeholder values shipped)

- Display: system sans (final pass: Mona Sans / Inter)
- Motion: snappy-default — 220ms base, standard ease
- Header: shrink-on-scroll
- Footer: brand-led XXL (video bg or oversized wordmark)
- Signature modules: product grid (tight), 3D viewers, scroll-snap galleries

## Stitch frames

_Slot — populate `theme.json#stitchFramesUrl` when the design pass lands._

## Implementation slots

- `theme.json` — manifest values
- `theme.scss` — semantic-token overrides
- `module-styles.scss` — per-module override layer (empty placeholder)
