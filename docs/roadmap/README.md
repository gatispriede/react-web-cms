# Roadmap plans

One markdown per roadmap item. Each file has the same shape:

- **Goal** — what shipping this means
- **Design** — approach, decisions, data model touches
- **Files to touch** — approximate surface
- **Acceptance** — how we know it's done
- **Effort** — rough time budget (see legend)

The headline [ROADMAP.md](../ROADMAP.md) stays as the short bullet list; these files are the "open this before you start" expansions.

## Effort legend

| Size | Budget | Reality |
|------|--------|---------|
| XS   | < 1 h  | Trivial edit, single file |
| S    | 1–3 h  | Focused change, maybe 1 test |
| M    | 0.5–1 day | Cross-file, needs a quick design call with yourself |
| L    | 1–3 days | New surface, migration, or UX polish loop |
| XL   | 1+ weeks | Architectural — break down further before starting |

Estimates assume one focused engineer already familiar with the codebase. Double for context-switching / review loops.

## Index

### Production / ops — deferred

Tracked separately under [production/](production/) so the two streams can be scheduled independently. See [production/README.md](production/README.md) for the full ordering.

| # | Item | Status |
|---|------|--------|
| P1 | [production/first-boot-admin-password.md](production/first-boot-admin-password.md) | **Shipped** |
| P2 | [production/automatic-deployment.md](production/automatic-deployment.md) | Planned |
| P3 | [production/digitalocean-domain-wiring.md](production/digitalocean-domain-wiring.md) | Planned |
| P4 | [production/seamless-deployment.md](production/seamless-deployment.md) | Planned |
| P5 | [production/mongodb-auth.md](production/mongodb-auth.md) | Planned |

### Feature / UX queue

| # | Item | Size | Notes |
|---|------|------|-------|
| N15 | [folder-structure-reorg.md](folder-structure-reorg.md) | XL | **Shipped (2026-04-24)** — `ui/{client,admin}/` + `services/` + `shared/` + `tools/` + `infra/`; see [migration-mapping.md](migration-mapping.md) |
| 9 | [tests-remaining.md](tests-remaining.md) | L | **Partial** — MongoApi facade + conflict + googleFonts tests shipped. LoginBtn / section snapshots / API integration still queued |

### Content editor — images, galleries, themes (added 2026-04-23)

| # | Item | Size | Notes |
|---|------|------|-------|
| C1 | [themes-as-files.md](themes-as-files.md) | M | **Shipped (2026-04-24)** — four editorial presets in `ui/client/themes/*.json`, seeded on boot when missing; admin "Reset to preset" overwrites DB row from disk |
| C2 | [image-optimization-on-upload.md](image-optimization-on-upload.md) | M | **Shipped (2026-04-24, partial)** — shared `imageOptimize.ts` pipeline (resize 1920 cap + recompress + strip EXIF + size guard) on both single + batch uploads; `IImage` schema fields (width/height/etc) deferred to a separate migration |
| C3 | [bulk-image-upload-with-ratio.md](bulk-image-upload-with-ratio.md) | L | **Shipped (2026-04-24)** — `/api/upload-batch` (sharp cover-crop + EXIF strip + collision-safe), `BulkImageUploadModal`, GalleryEditor "Bulk upload" button; per-image crop-handle deferred |
| C4 | [drag-drop-images-modules.md](drag-drop-images-modules.md) | M | **Shipped (2026-04-24)** — extended `useImageDrop` with OS file upload + URL re-host + per-file AntD toasts; shared `<ImageDropTarget>` wrapper + SCSS; wired into Gallery / Carousel / PlainImage / ImageUrlInput / Logo settings |
| C5 | [picker-improvements.md](picker-improvements.md) | M | **Shipped (2026-04-24)** — sort dropdown (recent/name/size), two-column grid + sticky resizable preview panel, always-visible name+size caption, per-tile info drawer, keyboard navigation, localStorage-persisted sort/search |
| C6 | [gallery-improvements.md](gallery-improvements.md) | L | **Shipped (2026-04-24, partial)** — aspect-ratio lock, Masonry style, per-tile `href`, up/down reorder; custom lightbox + drag-reorder deferred |
| C7 | [logo-style-options.md](logo-style-options.md) | S | **Shipped (2026-04-24)** — site-wide Logo `style` field + `.logo--{default,bordered,framed,circle}` SCSS + admin Style select; tokens fall back to theme so presets unchanged |
| C8 | [module-transparency-style.md](module-transparency-style.md) | S | **Shipped (2026-04-24)** — `transparent` flag on `ISection` + `.is-transparent` renderer rule + admin Switch with contrast hint |
| C9 | [production-caching.md](production-caching.md) | L | ISR + on-demand revalidation + Caddy SWR + DataLoader |
| C10 | [admin-modules-preview-page.md](admin-modules-preview-page.md) | M | **Shipped (2026-04-24)** — `/admin/modules-preview` with sample fixture per `EItemType`, theme-switcher dropdown (client-side `applyThemeCssVars`), transparent-bg toggle, module-name filter; sample-coverage test fails if a new type ships without a fixture |
| C11 | [admin-menu-icons.md](admin-menu-icons.md) | S | **Shipped (2026-04-24)** — icons on every main-nav button + settings tab + sidebar row; adapter extended with 11 new lucide mappings |
| BUG | [client-report-2026-04-24.md](client-report-2026-04-24.md) | S×3 | **Shipped (2026-04-24, commit 3074f99)** — Hero #1 + #2: `clamp()` font floors + `overflow-wrap: anywhere` + theme-tunable `--hero-scrim-opacity` scrim; Services #3 not reproducible, locked with regression tests |
| C12 | [image-width-height-respect.md](image-width-height-respect.md) | S | **Shipped (2026-05-02)** — `<SizedImage>` helper + `data-sized` opt-out on parent `.image` wrappers; SCSS carve-outs in Logo / Gallery / Carousel; PlainImage already used AntD `<Image>` width/height (no change needed); ProjectCard cover + Hero portrait skipped (no schema width/height fields yet) |
| C13 | [link-target-autosearch.md](link-target-autosearch.md) | M | **Shipped (2026-05-02)** — picker UX + readable section labels + stable-anchor emission for Hero / BlogFeed / ProjectCard (Manifesto / Timeline have no single representative title; deferred); `RevealOnScroll` forwards `id` |
| C14 | inline-edit text after add | S | **Shipped (2026-05-02)** — picker → primary-text-input autofocus on add (no autofocus on edit) |
| C15 | admin dark-mode theme | M | **Already shipped** — top-bar Switch (`AdminApp.tsx`), AntD `darkAlgorithm` via `ConfigProvider`, localStorage-persisted (`admin.darkMode`). Discovered 2026-05-02 — was not advertised |
| C16 | admin/client side-by-side editor layout | M | **Already shipped** — `AddNewSectionItem.tsx` Drawer renders `[editor tabs] | [live preview]` 2-column grid for **every** module type (preview pane keys on `selected/style/action/actionStyle` so every type and style remounts cleanly). Discovered 2026-05-02 — was not advertised |
| C17 | exhaustive style-matrix sample audit | S | **Partial (2026-05-02)** — broad coverage already (24/24 EItemTypes, key fields exercised on Hero/Carousel/PlainImage/ProjectCard). Field-level exhaustive audit deferred — open when client surfaces a specific gap |

### Reference docs

- [target-architecture.md](target-architecture.md) — naming conventions + top-level layout the reshape landed on. Open this before proposing structural changes.
- [migration-mapping.md](migration-mapping.md) — full old→new path table from the N15 reshape. Useful when chasing a stale import in docs / legacy notes.

### Suggested ordering

1. [tests-remaining.md](tests-remaining.md) — can run in parallel with any of the above
2. C2 → C3 → C4 → C5 → C6 — optimisation unlocks picker dimensions + gallery ratios; bulk upload unblocks gallery population
3. C7, C9 — interleave at any point; no hard dep on the image chain
4. C10 — best scheduled after C7 (style variants) so it can exercise style variants against the shipped theme registry
5. ~~C1 themes-as-files~~ — **done** (2026-04-24)
6. ~~C8 module-transparency-style~~ — **done** (2026-04-24)
7. ~~N15 folder-structure-reorg~~ — **done** (2026-04-24)

## Total rough budget

- Original queue: ~10–15 engineering days (N15 shipped — subtract ~1 week)
- Content-editor block (C1–C10): ~10–14 engineering days (C1 + C8 shipped — subtract ~1 day)
- Grand total remaining: ~3–5 focused weeks
