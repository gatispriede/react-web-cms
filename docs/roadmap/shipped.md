# Shipped roadmap items

Archive of completed roadmap entries. Latest first. Active backlog lives in [README.md](README.md).

## Production / ops

| # | Date | Notes |
|---|------|-------|
| P1 | 2026-04 | First-boot admin password — see [production/first-boot-admin-password.md](production/first-boot-admin-password.md) |
| P2 | 2026-05-03 | Automatic deployment — `.github/workflows/deploy.yml`, gated on `vars.DEPLOY_ENABLED`; runbook [docs/runbooks/automatic-deployment.md](../runbooks/automatic-deployment.md) |
| P3 | 2026-05-03 | DigitalOcean domain + TLS — Caddyfile env-driven (`DOMAIN`, `SITE_DOMAIN_WWW`), auto-HTTPS; runbook [docs/runbooks/digitalocean-domain.md](../runbooks/digitalocean-domain.md) |
| P4 | 2026-05-03 | Seamless (blue/green) deployment — `app-blue` / `app-green` (Compose `seamless` profile), Caddy `{$ACTIVE_UPSTREAM}` switch, orchestrator `tools/blue-green-deploy.sh`; gated by `vars.SEAMLESS_DEPLOY`; runbook [docs/runbooks/seamless-deployment.md](../runbooks/seamless-deployment.md) |
| P5 | 2026-05-03 | MongoDB auth — `tools/mongo-bootstrap.sh` + `mongoConfig.buildMongoUri`; runbook [docs/runbooks/mongo-auth-setup.md](../runbooks/mongo-auth-setup.md) (dev path preserved) |

## Content editor

| # | Date | Notes |
|---|------|-------|
| N15 | 2026-04-24 | Folder reshape — `ui/{client,admin}/` + `services/` + `shared/` + `tools/` + `infra/`. See [migration-mapping.md](migration-mapping.md) |
| C1 | 2026-04-24 | Themes as files — four editorial presets in `ui/client/themes/*.json`, seeded on boot when missing; admin "Reset to preset" overwrites DB row from disk |
| C2 | 2026-04-24 | Image optimization on upload (partial) — shared `imageOptimize.ts` pipeline (resize 1920 cap + recompress + strip EXIF + size guard) on both single + batch uploads |
| C3 | 2026-04-24 | Bulk image upload with ratio — `/api/upload-batch` (sharp cover-crop + EXIF strip + collision-safe), `BulkImageUploadModal`, GalleryEditor "Bulk upload" button |
| C4 | 2026-04-24 | Drag-drop images modules — extended `useImageDrop` with OS file upload + URL re-host + per-file AntD toasts; shared `<ImageDropTarget>` wrapper + SCSS |
| C5 | 2026-04-24 | Picker improvements — sort dropdown (recent/name/size), two-column grid + sticky resizable preview panel, always-visible name+size caption, per-tile info drawer, keyboard navigation |
| C6 | 2026-04-24 | Gallery improvements (partial) — aspect-ratio lock, Masonry style, per-tile `href`, up/down reorder; custom lightbox + drag-reorder deferred |
| C7 | 2026-04-24 | Logo style options — site-wide Logo `style` field + `.logo--{default,bordered,framed,circle}` SCSS + admin Style select |
| C8 | 2026-04-24 | Module transparency style — `transparent` flag on `ISection` + `.is-transparent` renderer rule + admin Switch with contrast hint |
| C9 | 2026-05-02 | Production caching — `bootId` + per-feature version stamps in Redis (`cacheVersion.ts`), `X-Cms-Cache-Tag` header, Caddy SWR fragment + [runbook](../runbooks/caddy-cache.md), DataLoader fold-in via `ServiceLoader.batchAccessors` (Posts is the demo) |
| C10 | 2026-04-24 | Admin modules preview page — `/admin/modules-preview` with sample fixture per `EItemType`, theme-switcher dropdown, transparent-bg toggle, module-name filter; sample-coverage test |
| C11 | 2026-04-24 | Admin menu icons — icons on every main-nav button + settings tab + sidebar row; adapter extended with 11 new lucide mappings |
| C12 | 2026-05-02 | Image width/height respect — `<SizedImage>` helper + `data-sized` opt-out on parent `.image` wrappers; SCSS carve-outs in Logo / Gallery / Carousel |
| C13 | 2026-05-02 | Link target autosearch — picker UX + readable section labels + stable-anchor emission for Hero / BlogFeed / ProjectCard; `RevealOnScroll` forwards `id`. Manifesto / Timeline anchor support deferred (no single representative title) |
| C14 | 2026-05-02 | Inline-edit text after add — picker → primary-text-input autofocus on add (no autofocus on edit) |
| C15 | already shipped | Admin dark-mode theme — top-bar Switch (`AdminApp.tsx`), AntD `darkAlgorithm` via `ConfigProvider`, localStorage-persisted (`admin.darkMode`). Hoisted to top-top bar 2026-05-03 with chrome-only SCSS scoping |
| C16 | already shipped | Admin/client side-by-side editor layout — `AddNewSectionItem.tsx` Drawer renders `[editor tabs] | [live preview]` 2-column grid for every module type |
| C18 | 2026-05-02 | Image-ref + link-ref schema convergence — `IImageRef` + `ILinkRef` shared shapes; `<ImageRefInput>` + `<LinkRefInput>` shared editors; per-module ContentManager normalises legacy → new shape |
| BUG | 2026-04-24 | Client report — Hero #1 + #2: `clamp()` font floors + `overflow-wrap: anywhere` + theme-tunable `--hero-scrim-opacity` scrim. Services #3 not reproducible, locked with regression tests |

## Build / DX

| # | Date | Notes |
|---|------|-------|
| Q1+VM4 | 2026-05-03 | ESLint flat config + VM4 lint rule banning `useState` in `ui/admin/features/**` |
| Q2 | 2026-05-03 | VM3 — Themes + Translations panes migrated to ViewModel pattern; ~10 sub-panes still carry `eslint-disable` markers (see open backlog) |
| Q4 | 2026-05-03 | Visual regression baselines — Playwright `toHaveScreenshot()` config + 58 spec entries (48 module Display+Editor, 9 critical surfaces, 1 Footer); CI shard config; runbook [docs/runbooks/visual-regressions.md](../runbooks/visual-regressions.md). **Image capture pending** — see open backlog |
| Q5 | 2026-05-03 | Admin-segregation Phase 3 observability — Next edge middleware logs every legacy-route hit via `/api/log/error` (level: warn, scope: legacy-route) before redirect fires. **Deletion pending** — see open backlog |
| Q6 | 2026-05-03 | Conditional gqty regen on prebuild — `tools/check-schema-stale.js` mtime-checks `services/api/schema.graphql` vs generated client |

## Auth / multi-tenancy

| # | Date | Notes |
|---|------|-------|
| Q10 | 2026-05-03 | Edit-levels three-dimension grants (FeatureGrant / PageGrant / LocaleGrant) — intersection semantics, admin-role bypass, Posts wired as the reference. See [docs/architecture/auth-roles.md](../architecture/auth-roles.md) |

## Go-to-market (Q7)

| # | Date | Notes |
|---|------|-------|
| Q7-wizard | 2026-05-03 | First-run onboarding wizard — site name + admin account + theme pick at `/admin/onboarding`. Server-side fresh-install gate via `/api/onboarding/is-fresh-install` |
| Q7-landing | 2026-05-03 | Marketing landing page — `/welcome` always-on; `/` flips to landing on fresh installs (`pages.length === 0`). Visual baseline added |
| Q7-docs | 2026-05-03 | Docs site — `docs/site/*.md` source; `tools/seed-docs-bundle.js` generates a CMS bundle; admin imports it; `/docs` index + `/docs/[slug]` per-page routes |

## Misc

| # | Date | Notes |
|---|------|-------|
| favicon | 2026-05-03 | Dynamic `/api/favicon` route serves the active site's Logo SVG when present, falls back to a monogram SVG built from siteName initial(s) |
| simplified-mode-cuts | 2026-05-03 | Admin UI mode toggle now visibly changes the UI: top-bar areas (SEO/Release/System), content area-nav (Products/Inventory/Orders), Layout pane sub-sections, module picker (8 of 24 types), Action tab, Style sub-options, Publish button, click-to-edit on module body. See [docs/features/platform/admin-ui-modes.md](../features/platform/admin-ui-modes.md) |
| dark-mode-hoist | 2026-05-03 | Dark/light + simplified/advanced switchers hoisted from `AdminApp` secondary header to `UserStatusBar` top-top bar — visible on every admin route. Chrome-only SCSS scoping so the build-page preview stays in client theme |
| components-drop | 2026-05-03 | `ui/client/components/` removed; Marketing + Cart moved to `ui/client/features/{Marketing,Cart}/` to match target architecture |
