# Drag-and-drop images onto image-bearing modules

## Goal

Let editors drop an image from their desktop (or from the picker grid) straight
onto any module that displays an image — PlainImage, Gallery tile, Logo,
Card cover — and have it upload + wire up in one gesture.

Today ([useImageDrop.ts](../ui/client/lib/useImageDrop.ts)) handles only
internal `application/x-cms-image` drags between picker and target. OS-level
file drops fall through to the browser default (opens the image in a new tab,
replacing the admin).

## Design

### Accepted drop sources

1. **OS file drag** (`DataTransfer.files`): upload via existing
   `/api/upload` (or `/api/upload-batch` once
   [bulk-image-upload-with-ratio.md](bulk-image-upload-with-ratio.md) lands),
   then set the resulting `src` on the module.
2. **Internal picker drag** (`application/x-cms-image`): existing behaviour —
   set `src` from the dragged tile.
3. **URL drag** (from another tab — `text/uri-list`): fetch + re-host locally.
   Declining external hotlinks avoids broken-over-time images and content-policy
   surprises.

### Drop targets

Any component rendering an editable image. Extract a shared
`<ImageDropTarget>` wrapper:

```tsx
<ImageDropTarget onImage={(src) => onChange({...data, src})}>
  <img src={data.src} />
</ImageDropTarget>
```

Applies to:

- `PlainImage` admin preview
- `InputGallery` tiles (drop on an empty slot appends; drop on filled replaces)
- `InputLogo` once [logo-style-options.md](logo-style-options.md) formalises it
- Any Card-like section with a cover image

### Visual feedback

- `dragenter` → dashed outline + accent-coloured overlay on valid target
- `dragover` → show "drop to replace" or "drop to add" tooltip based on slot state
- `drop` → brief progress spinner on the target until upload resolves
- Invalid type (e.g. non-image) → red outline + toast

### Keyboard parity

Dropping is mouse-only. For keyboard users, the existing picker + "Set image"
button path stays. Document this in the a11y section of the picker modal.

## Files to touch

- `ui/client/lib/useImageDrop.ts` — extend to accept `files` + URI lists
- `ui/client/lib/ImageDropTarget.tsx` — new wrapper
- `ui/admin/modules/InputGallery.tsx` — wrap tiles
- `ui/client/modules/PlainImage.tsx` (admin path) — wrap
- `ui/admin/modules/InputLogo.tsx` — wrap
- `ui/client/styles/Admin/ImageDropTarget.scss` — drop-state styles

## Acceptance

- OS file drop onto a PlainImage slot uploads + sets `src` in one action
- Drop onto a filled Gallery tile replaces; drop onto empty tile / "+" button appends
- Invalid file type (e.g. `.pdf`) shows a clear error, doesn't crash the editor
- Existing internal picker-to-target drag still works (no regression)
- Drop zones have visible focus-like outlines on `dragenter`

## Depends on / pairs with

- [bulk-image-upload-with-ratio.md](bulk-image-upload-with-ratio.md) — multi-file
  drops route through the batch endpoint.
- [image-optimization-on-upload.md](image-optimization-on-upload.md) — dropped
  files get the same optimisation pipeline as picker uploads.

## Effort

**M** — 0.5–1 day. Hook extension + shared wrapper + wiring into 3–4 targets
+ drop-state styling.
