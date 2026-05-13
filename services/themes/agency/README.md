# Agency — design doc (placeholder)

**Status:** placeholder. Wave 5 infrastructure jump shipped the slot; real visual design lands in a follow-up jump from Stitch frames.

## Target audience

Design / dev / marketing agencies. Team voice (vs `portfolio` individual voice).

## Mood

Bold, motion-forward, confident, modern. Dark-default.

## When to pick this

Case-study-led portfolios. Agencies showing project work. Studios.

## When NOT to pick this

Individual creators (use `portfolio`). SaaS products (use `saas-landing` — same dark+oversized but different module set: product screenshots + pricing table).

## Design elements (target — placeholder values shipped)

- Display: system sans (final pass: oversized display sans, e.g. Inter Display / Söhne)
- Motion: expressive-bold — 280ms base, expressive ease
- Header: shrink-on-scroll
- Footer: multi-column
- Differentiator vs `saas-landing`: case-study scroll storytelling + project tiles (NOT product screenshots + feature grid)

## Stitch frames

_Slot — populate `theme.json#stitchFramesUrl` when the design pass lands._

## Implementation slots

- `theme.json` — manifest values
- `theme.scss` — semantic-token overrides
- `module-styles.scss` — per-module override layer (empty placeholder)
