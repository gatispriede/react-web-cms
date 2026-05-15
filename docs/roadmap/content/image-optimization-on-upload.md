# Image optimisation on upload

> **Shipped (2026-05-14, complete)** — closes the remaining gaps from the
> 2026-04-24 partial. Shared pipeline lives at
> `services/features/Assets/imageOptimize.ts` (`optimizeImageBuffer` /
> `optimizeImageFile` / `readImageMetadata`). Now used by **all four** image
> ingest paths: `/api/upload` (single-file), `/api/upload-batch` (files +
> URLs), the `image.upload` MCP tool, and the `rescanDiskImages` recovery
> path. Behaviour: auto-orient via EXIF → optional cover-crop (ratio lock,
> batch only) → resize cap 1920 long edge `withoutEnlargement` → recompress
> (jpeg q78 mozjpeg progressive / png lvl9 / webp q82 / avif q60) → strip
> EXIF. Size guard means already-compressed re-uploads keep their original
> bytes.
>
> **What this jump added on top of the 2026-04-24 partial:**
> - `/api/upload-batch` (files + URL paths) now builds the persisted record
>   via the shared `buildImageRecord` helper — previously it wrote a bare
>   `InImage` literal and silently dropped every optimisation/provenance
>   field. Single-file `/api/upload` already used the helper; the two
>   endpoints now persist a byte-identical record shape.
> - `OptimizeResult.readable` flag — distinguishes "corrupt, can't decode"
>   from "valid but not transcoded" (SVG/GIF). Both upload endpoints + the
>   MCP tool now **reject corrupt input with 400 / `{ok:false}`** before
>   writing anything, so a half-written / garbage file never lands in
>   `public/images/` (spec "Failure modes"). SVG/GIF still pass through.
> - `readImageMetadata(srcPath)` helper + `rescanDiskImages` now extracts
>   `width`/`height`/`format` for raster files it recovers — rescanned
>   records carry the same dimension metadata a fresh upload would (spec
>   "still persist dimensions for raster paths").
> - The `image.upload` MCP tool now runs the optimise pipeline (it used to
>   write raw bytes verbatim) — MCP is the canonical write path, so an
>   LLM-uploaded image gets the same treatment as one dropped through the
>   admin form. Returns `width`/`height`/`optimised` in the tool result.
> - 9 hermetic unit tests on `imageOptimize.ts` (was 6) — added `readable`
>   assertions + `readImageMetadata` coverage. No checked-in binaries.
>
> **Still deferred (unchanged):** the GraphQL SDL exposure of
> `width`/`height`/`sizeBytes`/`originalName`/`uploadedBy`/`uploadedAt`.
> Those fields are now **persisted to Mongo on every ingest path** (write-
> through — Mongo is schemaless), so the SDL migration is a pure read-side
> change with no back-fill needed for anything uploaded after this ships.
> `IImage`/`InImage` are GraphQL-generated, so the SDL edit + client
> regeneration is tracked as its own read-side migration item.

## Goal

Every image that enters the CMS lands on disk already resized, recompressed and
metadata-stripped — so editors can drop 12 MB phone photos without slowing
down the public site, and so galleries ship sensibly-sized bytes by default.

Today [upload.ts](../ui/client/pages/api/upload.ts) writes the original
bytes verbatim to `public/images/`. We've already seen the fallout:
`Skyclimber/v1.json` and `v2.json` bundles contained base64-embedded phone
JPEGs that were shrunk ~65% by a one-off sharp pass
([scripts/optimize-bundle-images.mjs](../scripts/optimize-bundle-images.mjs)).
That pass should never have been needed — the pipeline should have done it on
ingest.

## Design

### Pipeline

On upload receive (single or batch):

1. Read bytes into a sharp pipeline (already installed locally — see the
   one-off script above).
2. **Resize**: cap to `MAX_DIM = 1920` on the longest edge (`withoutEnlargement`).
3. **Recompress**:
   - JPEG input → JPEG `quality 78`, `progressive`, `mozjpeg: true`
   - PNG with alpha → keep PNG (palette + `compressionLevel 9`)
   - PNG without alpha → convert to JPEG at same settings
   - WebP / AVIF input → keep format, re-encode at `quality 78`
4. **Strip EXIF** (sharp does this by default when re-encoding, but be explicit
   with `.withMetadata({orientation})` so rotation survives).
5. **Extract dimensions** (`width`, `height`) and persist on the image record —
   downstream consumers ([picker-improvements.md](../admin/picker-improvements.md),
   [gallery-improvements.md](gallery-improvements.md)) want this.
6. **If output > input bytes**, keep the original — never regress.

### Data model

Add to `IImage`:

```ts
width: number;
height: number;
sizeBytes: number;
originalName: string;  // for picker display
uploadedBy?: string;   // user id
uploadedAt: Date;
```

### Failure modes

- Corrupt input → reject with 400 + message; don't leave half-written file.
- Sharp throws on unsupported format → accept the file as-is (e.g. SVG, GIF).
  Skip the pipeline, still persist dimensions for raster paths.

### Background vs sync

Do it **synchronously on upload** for now — simpler, correctness first. A
worker queue is overkill for a CMS with low upload volume. Revisit only if
p95 upload time > 3 s (measurable; not today's problem).

## Files to touch — as shipped

- `services/features/Assets/imageOptimize.ts` — shared pipeline + the
  net-new `OptimizeResult.readable` flag + `readImageMetadata()` helper.
- `services/infra/imageMetadata.ts` — `buildImageRecord()`, the single
  source of truth for the persisted record shape (pre-existing; now used by
  every ingest path).
- `ui/client/pages/api/upload.ts` — corrupt-input 400 reject.
- `ui/client/pages/api/upload-batch.ts` — switched both the file and URL
  paths onto `buildImageRecord` + corrupt-input reject.
- `services/features/Assets/AssetService.ts` — `rescanDiskImages` extracts
  raster dimensions via `readImageMetadata`.
- `services/features/Mcp/tools/images.ts` — `image.upload` MCP tool runs
  the optimise pipeline + persists the full record shape.
- `services/features/Assets/imageOptimize.test.ts` — 6 → 9 tests.
- `package.json` — `sharp` was already in `dependencies` (no move needed).
- `scripts/optimize-bundle-images.mjs` — left in place as a tagged one-shot
  for legacy bundles; the pipeline now makes it unnecessary for new ingest.

## MCP coverage

No new operator-editable *config* — the pipeline knobs (1920 cap, quality
values) are code constants, not authored content, so there's no admin UI
and no new MCP config tool to add. The MCP **parity** that mattered here is
that `image.upload` (the canonical AI write path) now runs the *same*
pipeline as the admin upload form, instead of writing raw bytes — closing a
silent divergence between the two write paths.

## Acceptance

- 4000×3000 phone JPEG (12 MB) ingests as ≤500 KB, longest edge 1920 px —
  ✅ covered by the `caps the longest edge at 1920` unit test.
- PNG logo with transparency stays PNG — ✅ `PNG stays PNG` unit test.
- Image dimensions persisted on every ingest path (upload / batch / MCP /
  rescan) so the picker reads them without re-opening the file — ✅.
- EXIF stripped from output (sharp drops metadata on re-encode; `.rotate()`
  bakes orientation into pixels first) — ✅.
- Re-uploading an already-optimised file doesn't bloat it — ✅ size-guard
  unit test.
- Corrupt input rejected with 400 / `{ok:false}`, no file left on disk — ✅
  `readable:false` path on all three write endpoints.

## Depends on / pairs with

- [bulk-image-upload-with-ratio.md](bulk-image-upload-with-ratio.md) — same
  pipeline, batch entry point.
- [picker-improvements.md](../admin/picker-improvements.md) — consumes the new
  `width`/`height` for orientation filter + preview box.

## Effort

**M** — 0.5–1 day. Pipeline + data-model field additions + migration for
existing rows (back-fill dimensions via one-shot script).
