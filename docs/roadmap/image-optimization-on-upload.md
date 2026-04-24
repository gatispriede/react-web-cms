# Image optimisation on upload

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
   downstream consumers ([picker-improvements.md](picker-improvements.md),
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

## Files to touch

- `ui/client/pages/api/upload.ts` — pipeline on single upload
- `ui/client/pages/api/upload-batch.ts` — same pipeline (shared helper)
- `services/AssetService.ts` — `optimizeAndStore(bytes, meta)` helper
- `shared/types/IImage.ts` — new fields
- `package.json` — `sharp` from `devDependencies` → `dependencies`
- Drop `scripts/optimize-bundle-images.mjs` once pipeline is proven in prod
  (or keep as a one-shot for legacy bundles; tag it as such)

## Acceptance

- 4000×3000 phone JPEG (12 MB) ingests as ≤500 KB, longest edge 1920 px
- PNG logo with transparency stays PNG
- Image dimensions available in the picker without an extra round-trip
- EXIF GPS stripped from output (verify with `exiftool`)
- Re-uploading an already-optimised file doesn't bloat it (guard clause works)

## Depends on / pairs with

- [bulk-image-upload-with-ratio.md](bulk-image-upload-with-ratio.md) — same
  pipeline, batch entry point.
- [picker-improvements.md](picker-improvements.md) — consumes the new
  `width`/`height` for orientation filter + preview box.

## Effort

**M** — 0.5–1 day. Pipeline + data-model field additions + migration for
existing rows (back-fill dimensions via one-shot script).
