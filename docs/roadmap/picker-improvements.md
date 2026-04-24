# Picture selection picker — show-more + preview box

## Goal

Improve the image picker modal ([ImageUpload.tsx](../ui/admin/features/Assets/ImageUpload.tsx))
so operators can see, tag, and disambiguate assets without opening each one.

Today the picker shows a tiled grid. Metadata surfaced on hover is minimal.
Once selected, operators don't get a large enough preview to sanity-check the
choice before closing the modal.

## Design

### 1. Collapsible "more info" per tile

Small info chevron on each tile expands a panel (or right-side drawer) with:

- Filename, dimensions (once image-optimization-on-upload stores them), size
- Uploaded by / date
- Tags (editable)
- Alt text (editable — currently only lives on the section usage, which means
  the same image has different alt in every section; centralising it avoids
  a11y regressions)
- Usage count: which sections currently reference this image (simple join on
  `Items.content` containing `src`)

### 2. Persistent preview box (~100×60 default, resizable to ~400×240)

Fixed panel (top-right of the modal) that mirrors whichever tile the cursor
hovers or keyboard-focuses. Same box shows the confirmed-selected image once
the user clicks. Not a lightbox — just a quick-check thumbnail to catch
wrong-image selections before closing.

### 3. Filter + sort upgrades (small, paired)

- Sort: `recent`, `name`, `size`, `unused`
- Filter: `has tag`, `orientation` (portrait/landscape/square — cheap once
  dimensions are stored)

## Files to touch

- `ui/admin/features/Assets/ImageUpload.tsx` — layout (grid + side panel)
- `ui/admin/features/Assets/ImageUpload.scss` (new or extend existing)
- `shared/types/IImage.ts` — add `width`, `height`, `uploadedBy` (hydrated by
  [image-optimization-on-upload.md](image-optimization-on-upload.md))
- `services/AssetService.ts` — add `listImagesWithUsage()` method

## Acceptance

- Expanding tile info is keyboard-accessible (Enter/Space)
- Alt text edits persist without closing the picker
- Preview box stays ≥100×60 at smallest viewport; grows up to ~400×240
- Sort + filter round-trip with URL query params so the state survives reload

## Depends on

- [image-optimization-on-upload.md](image-optimization-on-upload.md) — provides
  width/height + normalised formats.

## Effort

**M** — 0.5–1 day for layout + preview; **S** extra for filters/sort.
