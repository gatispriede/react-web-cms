# Bulk image upload with aspect-ratio normalisation

> **Shipped (2026-04-24, re-confirmed complete 2026-05-14)** — new
> `POST /api/upload-batch` handler accepts `multiple` files + a `ratio` field
> (`free / 1:1 / 4:3 / 3:2 / 16:9`). Each file runs through sharp: auto-orient
> via EXIF → `resize(w,h,{fit: 'cover', position: 'attention'})` when ratio is
> locked → recompress (mozjpeg / png compressionLevel 9 / webp q82) → strip
> EXIF. Collisions are resolved with `-N` suffix instead of rejecting (fixes
> the `IMG_0001.jpg` phone-batch case noted in the spec). Per-file results
> come back in a parallel array so one bad file never aborts a 30-image batch.
> The C2 jump (2026-05-14) routed the file *and* URL-fetch paths through
> `buildImageRecord` so the batch endpoint persists the full optimisation /
> provenance record shape, and added corrupt-input rejection before write.
>
> Admin surface: `BulkImageUploadModal` (`ui/admin/lib/BulkImageUploadModal.tsx`)
> — drop-zone + file-picker + `From device` / `From URL` tabs + aspect-ratio
> `Select` + XHR upload with real progress + per-file error list. Wired into
> `GalleryEditor` (`ui/admin/modules/Gallery/GalleryEditor.tsx`) as a "Bulk
> upload" button next to the aspect-ratio select — pre-fills the modal with
> the gallery's current ratio and appends each accepted image as a new gallery
> item. The `GalleryEditor` ratio select + bulk-upload button carry
> `data-testid` (`gallery-editor-aspect-ratio-select`,
> `gallery-editor-bulk-upload-button`).
>
> **MCP parity:** `image.upload` (`services/features/Mcp/tools/images.ts`)
> accepts the same `ratio` enum and runs the identical sharp cover-crop, so
> the AI write path matches the human bulk-upload flow.
>
> `sharp` made an explicit dependency in `package.json` (was transitive via
> Next.js).
>
> **Deferred:** per-image crop-handle UI (drag centre pre-upload). The
> `position: 'attention'` heuristic handles most phone shots well; a proper
> crop UI pairs better with C5 picker-improvements which needs preview work
> anyway. Also outstanding — `data-testid` attributes on
> `BulkImageUploadModal.tsx`'s own controls (ratio select / drop-zone / tabs /
> upload button); the file currently lives under `ui/admin/lib/*`, owned by a
> concurrent agent track, so the testid pass on the modal is left to whichever
> jump next touches that file.

## Goal

Let an operator drop a folder's worth of photos into the picker and have them
all uploaded + normalised to a chosen ratio (e.g. `16:9` for a Marquee gallery)
in one action — without opening the host file-system tool.

Today ([upload.ts](../ui/client/pages/api/upload.ts)) accepts one file per
request, no cropping, no resize. Populating a 30-image gallery = 30 dialog
clicks. Clients arrive with mixed portrait + landscape phone shots that
look wrong in the gallery's grid.

## Design

### Upload UI

- Drag-drop zone (or file picker) that accepts `multiple` on the
  `ImageUpload` modal *and* inside `InputGallery`.
- Ratio selector at the top of the batch: `free`, `1:1`, `4:3`, `3:2`, `16:9`.
- Per-image preview row with a crop handle (keeps the centre by default, draggable).
- "Apply ratio to all" toggle (off = per-image crop).
- Progress bar; on failure of any one, surface inline, don't abort the batch.

### Server

- New `POST /api/upload-batch` (or extend existing; multipart with multiple
  `file` parts).
- On server: use [sharp](https://sharp.pixelplumbing.com/) — already installed
  locally, seen in [scripts/optimize-bundle-images.mjs](../scripts/optimize-bundle-images.mjs)
  — to resize and crop on receive. Emit one DB row per accepted image.
- Same-name collision handling: append `-N` suffix rather than rejecting (today
  [upload.ts:45](../ui/client/pages/api/upload.ts#L45) blocks dups, which
  breaks batch uploads of repeating phone-generated names like `IMG_0001.jpg`
  across multiple phones).

### Gallery integration

- `InputGallery` gets a "Bulk upload" button wired to the same modal, with
  the gallery's `aspectRatio` pre-filled (from
  [gallery-improvements.md](gallery-improvements.md)).

## Files to touch

- `ui/client/pages/api/upload-batch.ts` — new handler
- `ui/admin/features/Assets/ImageUpload.tsx` — batch mode
- `ui/admin/modules/InputGallery.tsx` — add button
- `services/AssetService.ts` — `saveImages` (bulk)
- Depend on `sharp` at runtime (not just dev) — move from devDep if needed

## Acceptance

- ✅ 30 files / 80 MB uploads in one drop, progress visible — `upload-batch.ts`
  `maxTotalFileSize` 200 MB, XHR `upload.onprogress` drives the `Progress` bar
- ✅ All images land cropped to the chosen ratio — `optimizeImageFile({ratio})`
  cover-crop on every file + URL path
- ✅ Partial failure doesn't abort the batch; failed ones clearly marked —
  per-file `PerFileResult[]`, modal renders a failed-files `List`
- ✅ Batch upload triggered from Gallery editor auto-adds images to that
  gallery — `GalleryEditor` `handleBulkUploaded` appends each accepted image
  as a new gallery item

## Depends on / pairs with

- [image-optimization-on-upload.md](image-optimization-on-upload.md) —
  optimisation runs in the same pipeline (resize → crop → recompress → store).
- [gallery-improvements.md](gallery-improvements.md) — ratio source.

## Effort

**L** — 1–2 days. Server pipeline, UI batch flow, crop handle UX.
