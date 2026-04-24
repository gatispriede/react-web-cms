# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [architecture/data-model.svg](architecture/data-model.svg). Completed work lives in git history.

Per-item implementation plans + time estimates live under [`roadmap/`](roadmap/). Start with [`roadmap/README.md`](roadmap/README.md) for the index.

---

## Queued

### Feature / UX

1. [tests-remaining.md](roadmap/tests-remaining.md) — LoginBtn + session render, per-section-type snapshots, API route integration tests

#### Content editor — images, galleries, themes (added 2026-04-23)

Grouped because most of these share the upload/optimise/picker surface and land cleanest in sequence.

9. [production-caching.md](roadmap/production-caching.md) — ISR + on-demand revalidation + Caddy SWR + DataLoader **(L)**
10. ~~[admin-modules-preview-page.md](roadmap/admin-modules-preview-page.md)~~ — **2026-04-24** — `/admin/modules-preview` renders every `EItemType` × every declared style × each sample fixture; sticky toolbar with theme switcher (writes CSS vars client-side, no reload), transparent-bg toggle, module-name filter; `samples.test.ts` fails if a new enum member lands without a fixture

Suggested order: 3 → 4 → 5 → 6 → 7 (optimisation first; it unblocks picker dimensions and gallery ratios). 8, 9 can interleave at any point; 10 is best after 8 but can ship earlier with a hardcoded theme list.

#### Shipped

- ~~[folder-structure-reorg.md](roadmap/folder-structure-reorg.md)~~ — **2026-04-24** — `ui/{client,admin}/` + `services/` + `shared/` + `tools/` + `infra/`
- ~~[module-transparency-style.md](roadmap/module-transparency-style.md)~~ — **2026-04-24** — shared `transparent` flag + admin Switch + contrast hint
- ~~[themes-as-files.md](roadmap/themes-as-files.md)~~ — **2026-04-24** — four editorial presets live as `ui/client/themes/*.json`; `ThemeService` seeds missing rows on boot; admin "Reset to preset" overwrites DB row from disk
- ~~[admin-menu-icons.md](roadmap/admin-menu-icons.md)~~ — **2026-04-24** — icons on every main-nav button, every settings tab, generic `FileOutlined` on every page sidebar row; 11 new lucide mappings in `@client/lib/icons`
- ~~[logo-style-options.md](roadmap/logo-style-options.md)~~ — **2026-04-24** — `ELogoStyle` (Default/Bordered/Framed/Circle) on site-wide Logo; `.logo--<style>` SCSS with theme-token fallbacks; admin Style select
- ~~[gallery-improvements.md](roadmap/gallery-improvements.md) (partial)~~ — **2026-04-24** — per-gallery aspect-ratio lock (`free/1:1/4:3/3:2/16:9`) + `EGalleryStyle.Masonry` CSS-columns + per-tile `href` + up/down reorder buttons; custom lightbox and drag-reorder deferred
- ~~[picker-improvements.md](roadmap/picker-improvements.md)~~ — **2026-04-24** — `ImageUpload.tsx` rewrite: sort dropdown (recent/name/size), two-column grid + sticky resizable preview panel, always-visible filename + size caption, per-tile info drawer with tags / type / added-on, keyboard navigation (`Tab` + `Enter/Space` picks), `localStorage`-persisted sort + search so the picker reopens where you left it
- ~~[drag-drop-images-modules.md](roadmap/drag-drop-images-modules.md)~~ — **2026-04-24** — extended `useImageDrop` with OS-file uploads (multi-file, per-file AntD toast on error) + URL re-hosting (`text/uri-list` / `text/plain` → `/api/upload`), shared `<ImageDropTarget>` wrapper with hover / upload / error chrome (`ImageDropTarget.scss`), wired into Gallery tiles + "Add" footer, Carousel tiles + footer, PlainImage, `ImageUrlInput`, and site-wide Logo settings. **Follow-up (same day)** — in-page drops covered too: new `AdminItemDropHost` wraps the *rendered* Display in `SectionContent.tsx` for Image / Gallery / Carousel / Hero / ProjectCard, so a rail thumbnail can be dropped straight onto the preview without opening the Edit modal; empty modules show a 100×100 dashed drop silhouette, filled ones highlight the replacement target.
- ~~[bulk-image-upload-with-ratio.md](roadmap/bulk-image-upload-with-ratio.md)~~ — **2026-04-24** — `POST /api/upload-batch` with sharp cover-crop to chosen ratio (EXIF stripped, collision-safe `-N` suffix) + `BulkImageUploadModal` (drop-zone, XHR progress, per-file error list) + GalleryEditor "Bulk upload" button pre-filling the gallery's ratio
- ~~[image-optimization-on-upload.md](roadmap/image-optimization-on-upload.md) (partial)~~ — **2026-04-24** — shared `imageOptimize.ts` pipeline (resize 1920 cap + recompress jpeg/png/webp/avif + strip EXIF + size guard + pass-through for unreadable) used by both single + batch uploads; `IImage` width/height/uploadedBy/etc schema fields deferred (GraphQL-generated type; needs separate SDL migration)

### Production / ops

Tracked under [`roadmap/production/`](roadmap/production/README.md) so feature/UX and ops can be scheduled independently.

| Item | Status |
|---|---|
| First-boot admin password | **Shipped** |
| [Automatic deployment](roadmap/production/automatic-deployment.md) | Planned |
| [Seamless deployment (zero-downtime)](roadmap/production/seamless-deployment.md) | Planned |
| [DigitalOcean domain + TLS wiring](roadmap/production/digitalocean-domain-wiring.md) | Planned |
| [MongoDB auth](roadmap/production/mongodb-auth.md) | Planned |

---

## Debt

All known debt items have been cleared. See `git log` for the fixes:
- ~~GQty client edits~~ — regenerated cleanly; introspection covers every previously hand-patched field.
- ~~sanitizeKey regex v2~~ — v1 dropped; correct regex + collision-safe hash suffix for long inputs.
- ~~Ghost Navigation docs~~ — root cause fixed; boot-time warning + idempotent cleanup script for legacy databases.
- ~~`react-drag-reorder` dependency~~ — dropped.
- ~~Dead-dep / peer-conflict cleanup~~ — `npm install` runs clean without `--legacy-peer-deps`.
