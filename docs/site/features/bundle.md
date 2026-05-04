# Bundle

The **Bundle** pane (`/admin/system/bundle`) exports and imports the entire site as a single JSON file. Use it for backups, environment promotion (staging → prod), and scripted seeding (the docs site uses this).

## Export

Click **Export bundle** → downloads `site-bundle-<timestamp>.json`. Contents:

- `manifest` — version + export timestamp + app id.
- `site` — every authoritative collection: navigation, sections, languages, images, logo, themes (+ active theme id), posts, footer config, site flags, site SEO defaults.
- `assets` — every locally-stored image referenced anywhere in `site`, base64-encoded as `data:` URIs.

Asset discovery walks every JSON-stringified content blob, so Hero background images, RichText embedded images, etc. are all captured — not just top-level Image entries.

## Import

Pick a bundle JSON → confirm. The import is **destructive**: existing collections are wiped and replaced. Order matters; the service handles it transactionally per collection. Image data URIs are decoded back to `ui/client/public/images/` with safety checks (whitelisted extensions, 25 MB cap, path-traversal rejection).

## Validation

Every section runs through `validateSectionInput` before any write. A malformed bundle is rejected atomically — your existing site stays intact.

## Seeded bundles

`tests/e2e/fixtures/bundles/` ships seed bundles:

- `cv-latest.json` — the showcase CV/portfolio site.
- `docs-bundle.json` — this docs site, generated from `docs/site/*.md` by `tools/seed-docs-bundle.js`.

Import either to populate a fresh CMS instance for inspection or iteration.
