# Gallery text-only mode (no broken image placeholders)

**Status:** Queued.

## Goal

Gallery module supports a text-only mode: when no images are configured, it renders text content (tiles, callouts) without broken-image placeholders. Acts as a clean alternative for text arranged the way Gallery already handles images.

## Design

- Add a `mode: 'images' | 'text' | 'mixed'` field (or infer from data: if any tile has an image → images/mixed, else text).
- Tile descriptor accepts `image?`, `title?`, `body?`. Text-only tiles render title + body with Gallery's rotation/flow behaviour, no image slot.
- If `image` is absent or invalid, never render an `<img>` — no fallback icon, no broken-image mark.
- Editor: when mode is text-only, collapse the image picker; when mixed, show per-tile image picker.

## Files to touch

- Gallery section component (render + editor)
- Gallery field schema
- Gallery SCSS — layout rules for text-only tiles (tighter padding, stronger typography)

## Acceptance

- A Gallery with zero images renders clean text tiles, no placeholders
- A Gallery with a mix of tiles (some image, some text) renders both types in the same layout
- Removing an image from a tile doesn't leave a broken `<img>`

## Effort

**S–M · 2–4 h**
