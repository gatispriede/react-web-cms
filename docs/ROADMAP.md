# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [architecture/data-model.svg](architecture/data-model.svg). Completed work lives in git history.

Per-item implementation plans + time estimates live under [`roadmap/`](roadmap/). Start with [`roadmap/README.md`](roadmap/README.md) for the index.

---

## Queued

### Feature / UX

1. [tests-remaining.md](roadmap/tests-remaining.md) — LoginBtn + session render, per-section-type snapshots, API route integration tests

#### Content editor — images, galleries, themes (added 2026-04-23)

Grouped because most of these share the upload/optimise/picker surface and land cleanest in sequence.

2. [themes-as-files.md](roadmap/themes-as-files.md) — presets as source-controlled JSON, loaded on boot **(M)**
3. [image-optimization-on-upload.md](roadmap/image-optimization-on-upload.md) — sharp resize/recompress/strip-EXIF pipeline **(M)** — *foundation for 4–6*
4. [bulk-image-upload-with-ratio.md](roadmap/bulk-image-upload-with-ratio.md) — multi-file upload + ratio crop **(L)**
5. [drag-drop-images-modules.md](roadmap/drag-drop-images-modules.md) — OS-file and URL drops onto image modules **(M)**
6. [picker-improvements.md](roadmap/picker-improvements.md) — show-more panel + persistent preview box + filter/sort **(M)**
7. [gallery-improvements.md](roadmap/gallery-improvements.md) — aspect-ratio lock, reorder, lightbox, Masonry style **(L)**
8. [logo-style-options.md](roadmap/logo-style-options.md) — Bordered / Framed / Circle variants **(S)**
9. [production-caching.md](roadmap/production-caching.md) — ISR + on-demand revalidation + Caddy SWR + DataLoader **(L)**
10. [admin-modules-preview-page.md](roadmap/admin-modules-preview-page.md) — admin matrix page × theme switcher for regression smoke-testing **(M)**
11. [admin-menu-icons.md](roadmap/admin-menu-icons.md) — icons on admin main menu + settings tabs + page sidebar **(S)**

Suggested order: 3 → 4 → 5 → 6 → 7 (optimisation first; it unblocks picker dimensions and gallery ratios). 2, 8, 9 can interleave at any point; 10 is best after 8 + 2 but can ship earlier with a hardcoded theme list.

#### Shipped

- ~~[folder-structure-reorg.md](roadmap/folder-structure-reorg.md)~~ — **2026-04-24** — `ui/{client,admin}/` + `services/` + `shared/` + `tools/` + `infra/`
- ~~[module-transparency-style.md](roadmap/module-transparency-style.md)~~ — **2026-04-24** — shared `transparent` flag + admin Switch + contrast hint

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
