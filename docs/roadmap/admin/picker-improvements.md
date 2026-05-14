# Picture selection picker — show-more + preview box

> **Shipped 2026-05-14.** Per-tile collapsible info panel (filename / dimensions /
> size / type / uploaded-by / date / usage count + editable alt-text & tags,
> keyboard-accessible Enter/Space), persistent resizable preview box
> (100×60 → 400×240), and paired sort (`recent` / `name` / `size` / `unused`) +
> filter (`has-tag`, `orientation`) with URL-query-param round-trip. `data-testid`
> on every control. `AssetService.listImagesWithUsage()` added for the usage join.
> As-built notes are in the **Status** section below.

## Goal

Improve the image picker modal (`ui/admin/lib/ImageUpload.tsx` — the spec's
`ui/admin/features/Assets/` path was approximate; the picker has always lived
under `ui/admin/lib/`)
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

- `ui/admin/lib/ImageUpload.tsx` — layout (grid + side panel), sort/filter,
  per-tile info drawer, persistent preview box
- `ui/admin/styles/Admin/ImageUpload.scss` — extended (drawer form fields,
  filter-row layout note, preview-box ceiling aligned to 400×240)
- `shared/types/IImage.ts` — added optional `width`, `height`, `sizeBytes`,
  `uploadedBy`, `uploadedAt`, `alt`, `usageCount` (hydrated by
  [image-optimization-on-upload.md](../content/image-optimization-on-upload.md);
  `width`/`height` also derived client-side from the loaded `<img>` for legacy rows)
- `services/features/Assets/AssetService.ts` — added `listImagesWithUsage()`

## Acceptance

- ✅ Expanding tile info is keyboard-accessible (Enter/Space) — the info chevron
  is a real `<button>`; `aria-expanded` mirrors the tile's `data-state`.
- ✅ Alt text edits persist without closing the picker — see Status note on the
  persistence path.
- ✅ Preview box stays ≥100×60 at smallest viewport; grows up to ~400×240 — native
  CSS `resize: both` with `min/max` bounds.
- ✅ Sort + filter round-trip with URL query params so the state survives reload —
  namespaced `pkr*` params via `history.replaceState` (no history spam, no
  collision with the edited page's own query string).

## Status — as-built (2026-05-14)

- **Per-tile info drawer** surfaces filename, dimensions, size (`sizeBytes`
  preferred), type, uploaded-by, date (`uploadedAt` preferred), usage count, plus
  editable **alt text** and **tags**. One tile expands at a time so grid rows
  don't tear.
- **Dimensions / orientation** read persisted `width`/`height` first and fall
  back to the client-measured natural size of the loaded `<img>` — so the
  orientation filter and dimensions row work even for rows uploaded before the
  optimise pipeline persisted dimensions.
- **`AssetService.listImagesWithUsage(tags, conn?)`** wraps `getImages` and runs
  the shared `ImageUsageService` scanner to attach `usageCount` per record — the
  read-side analogue of MCP `image.list { includeUsage }`. It's on the concrete
  `AssetService` class (not the `IAssetService` interface in `services/infra/`,
  which stayed untouched).
- **Deferred — server-side persistence of alt/tags + `usageCount` to the
  picker.** The GraphQL `IImage` SDL (`services/api/schema.graphql`) still only
  exposes the original 7 fields, and there's no `updateImage` mutation. Until
  those land, the picker persists per-image **alt text + tag edits** to a
  `localStorage` override store (keyed by image id — survives reload, satisfies
  "persist without closing"), and `usageCount` shows in the info row / drives the
  `unused` sort only when the image object carries it (degrades to `recent`
  order + "—" otherwise). Closing the gap is a pure read/write-side GraphQL
  migration: add the SDL fields + an `updateImage` mutation, then swap the
  override store for a real round-trip. `listImagesWithUsage()` is already the
  backend half.

## Depends on

- [image-optimization-on-upload.md](../content/image-optimization-on-upload.md) — provides
  width/height + normalised formats.

## Effort

**M** — 0.5–1 day for layout + preview; **S** extra for filters/sort.
