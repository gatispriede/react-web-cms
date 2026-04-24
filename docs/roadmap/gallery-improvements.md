# Gallery module improvements

## Goal

Make the Gallery module first-class for client photo reels — responsive,
accessible, with richer layout controls and consistent with the new DnD /
bulk-upload flows coming in other roadmap items.

Current state ([Gallery.tsx:9-35](../ui/client/modules/Gallery.tsx),
[InputGallery.tsx](../ui/admin/modules/InputGallery.tsx)):

- Styles: `Default | Marquee | LogoWall | HazardStrip`
- Per-item: `src`, `alt`, `text`, `imgWidth`, `imgHeight`, `textPosition`
- No reorder UX beyond drop-on-item
- No lightbox (only antd's `Image` preview fallback, which is minimal)
- No aspect-ratio lock (client photos arrive as a mess of portrait / landscape)

## Design

- **Aspect ratio lock per gallery**: dropdown `1:1 / 4:3 / 3:2 / 16:9 / free`;
  enforced via `object-fit: cover` on tiles. Pairs with the
  [bulk-image-upload-with-ratio](bulk-image-upload-with-ratio.md) feature so a
  gallery can be populated from a ratio-matched batch upload.
- **Reorder**: keyboard + mouse drag-to-reorder inside the gallery editor
  (extend `useImageDrop` or add a lightweight list-dnd like `dnd-kit/sortable`).
- **Lightbox**: click a gallery tile → modal with arrow-key nav + swipe on
  mobile. Reuses existing `Image.Preview` antd component with custom
  toolbar hidden.
- **Captions**: always render `alt` + optional `text` below the tile; currently
  `text` rendering is style-dependent and inconsistent.
- **New "Masonry" style** for portrait+landscape mixed content, driven by
  CSS columns (no JS layout engine needed).
- **Per-item link** (optional): `href` field so gallery tiles can link into blog
  posts / external URLs.

## Files to touch

- `ui/client/modules/Gallery.tsx`
- `ui/admin/modules/InputGallery.tsx`
- `ui/client/styles/Components/Gallery.scss` (may need split per style)
- `shared/types/IGallery*.ts` — add `aspectRatio`, `href`
- New style: `EGalleryStyle.Masonry`

## Acceptance

- Aspect-ratio setting takes effect immediately across all items
- Keyboard-reorderable; `Tab` through tiles, `Space` + arrows to move
- Lightbox opens on tile click, keyboard + swipe navigation
- Masonry renders correctly with mixed-orientation photos
- Mobile (≤480px) layout remains usable (2 cols or single column)

## Depends on

- [bulk-image-upload-with-ratio.md](bulk-image-upload-with-ratio.md) — natural
  pairing; implement that first so galleries get populated in one action.

## Effort

**L** — 1–2 days. Layout work + DnD reorder + lightbox wiring + 3 style variants.
