# Roadmap — redis-node-js-cloud CMS

Forward-looking only. For the current architecture see [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and the UML at [architecture/data-model.svg](architecture/data-model.svg). Completed work lives in git history.

Per-item implementation plans + time estimates live under [`roadmap/`](roadmap/). Start with [`roadmap/README.md`](roadmap/README.md) for the index.

---

## Queued

### E-commerce track (specs landed 2026-04-29)

Five feature specs under [`docs/features/ecommerce/`](features/ecommerce/) describe the full extension of the CMS into an e-commerce flow. All five shipped 2026-04-29 (uncommitted on `develop`).

1. [features/ecommerce/customer-auth.md](features/ecommerce/customer-auth.md) — NextAuth Credentials + Google for customers, `kind` discriminator on `Users`, parallel customer-authz tables.
2. [features/ecommerce/products.md](features/ecommerce/products.md) — `Products` collection mirroring `Posts` shape; admin CRUD; public `/products` + `/products/[slug]`; CSV-overlay i18n.
3. [features/ecommerce/cart.md](features/ecommerce/cart.md) — guest carts in Redis (signed cookie, 30-day TTL), customer carts in Mongo, merge on sign-in; price snapshot at add-time, hard re-validate at checkout.
4. [features/ecommerce/inventory-warehouse.md](features/ecommerce/inventory-warehouse.md) — pluggable `IWarehouseAdapter`; cursor-based sync; per-field manual override locks; admin sync panel + dead-letter log.
5. [features/ecommerce/checkout.md](features/ecommerce/checkout.md) — Amazon-style multi-step flow; `Orders` collection + state machine; `IPaymentProvider` with `MockPaymentProvider` (Stripe slot-in via env switch); reservation-on-draft + 30-min sweep.

Implementation order (sequential — these touch shared files like `schema.graphql` and `authz.ts`): customer-auth → products → cart → inventory → checkout.

### Developer / quality track (specs landed 2026-04-29)

6. [features/tooling/mcp-server.md](features/tooling/mcp-server.md) — first-party MCP server exposing the CMS to AI clients (Claude Code, Cursor) as typed tools: pages, modules, translations, themes, products, inventory, site settings, audit. Scoped tokens, stdio + HTTP/SSE transports, every call audited as `actor: 'mcp:<token>'`.
7. [features/tooling/e2e-testing.md](features/tooling/e2e-testing.md) — Playwright suite under `tests/e2e/` covering every module × style and every feature surface; per-worker `mongodb-memory-server` + `next dev`; coverage gate ties module/feature lists to spec files. Phased rollout — infra first, then per-module specs, then visual regression.

### Architecture / platform track (specs landed 2026-04-29)

These three are cross-cutting refactors — they touch every feature module already shipped, so they should land *after* the e-commerce / MCP work stabilises.

8. [features/platform/plug-and-play-features.md](features/platform/plug-and-play-features.md) — first-class feature toggles per module (products, cart, checkout, inventory, blog, MCP, customer auth). Disabled features hide their admin tab, 404 their public routes, and refuse their GraphQL operations. Defaults: CMS-core on, e-commerce + MCP off until the operator opts in.
9. [features/platform/edit-levels.md](features/platform/edit-levels.md) — layer page-level / module-level / element-level edit grants on top of the existing `viewer | editor | admin` role rank. New `Permissions` collection joining user → resource → scope; `guardMethods` gains a per-resource check after the role check.
10. [features/platform/admin-ui-modes.md](features/platform/admin-ui-modes.md) — simplified (mandatory-only, non-technical) vs advanced (full feature management) admin UI modes. Per-user setting with site-wide default. Each feature pane declares its own simplified/advanced views via an `AdminPaneDescriptor`; the shell never branches on mode. Includes a "Things to do" first-run panel that overlaps with the queued go-to-market onboarding flow.
11. [features/platform/service-modularity.md](features/platform/service-modularity.md) — make `services/features/<X>/` self-contained: each folder owns its services, GraphQL SDL, resolvers, authz contributions, indexes via a `feature.manifest.ts`. Shared infra (`mongoDBConnection.ts`, `graphqlResolvers.ts`, `schema.graphql`, `authz.ts`) stops hardcoding feature names and enumerates manifests instead. Visible artefact: deleting a feature folder keeps the build green. Underpins plug-and-play (#8). Migration plan land smallest-first: Audit → Cart → Products → Inventory → Orders → Mcp/CmsAi → Customer auth → Core.
12. [features/platform/feature-registry-codegen.md](features/platform/feature-registry-codegen.md) — discovery mechanism for #11's manifests. **Build-time codegen of explicit static imports** so WebStorm / VS Code "Find Usages" continues to walk the full call graph through the registry — `import.meta.glob` and runtime fs scans break the IDE's symbol index. `tools/codegen-feature-registry.ts` writes `services/infra/featureRegistry.generated.ts`; `predev` + `prebuild` hooks regenerate; CI runs `:check` mode to fail on a stale file. Lands in lockstep with #11.

### E2E phase 2 (queued 2026-04-29; revised 2026-04-30)

13. ~~**Finalize testids on the gap modules**~~ — **2026-04-30** — `module-editor-primary-text-input` now lives on every editor that has a meaningful primary text field (24 modules covered; media-only Carousel/Gallery/Image use save-only specs). `section-module-type-picker-btn` added on `AddNewSectionItem`. McpTokensPanel got the full `mcp-issue-*` / `mcp-revoke-*` set. Remaining gaps are all sub-items below — the original "no testid at all" gap is closed.
14. ~~**Smoke scenario**~~ — **2026-04-29** — `tests/e2e/smoke/cv-bundle-chain.spec.ts` runs the 8-step chain (bundle import → 4 hover-edit modules → footer → Hero portrait → translation → publish → blog post) in ~25s. `npm run e2e:smoke` reuses an external dev server; theme-switch step deferred per #19 below.
15. ~~**Full e2e scenarios** (foundation)~~ — **2026-04-30** — `npm run e2e:full` builds prod (`.next-e2e/`), spawns one `next start` per worker against per-worker `mongodb-memory-server`, signs in once per worker via `context.storageState()`. **24 module specs + 17 feature specs**; 54 passing, 25 documented `fixme` markers, ~45s no-rebuild. The build orchestrator (`tools/e2e-build.js`) spins up its own `mongodb-memory-server` + standalone GraphQL — **no dependency on the local dev server**. Visual regression baselines and CI sharding still queued.

### E2E backlog (queued 2026-04-30 — discovered while landing #15)

These are the explicit `test.fixme` / `test.skip` markers in the e2e suite. Order by leverage:

16. **Empty-array `defaultContent` fix** — 7 modules (`List`, `ProjectGrid`, `Services`, `SocialLinks`, `StatsCard`, `Testimonials`, `Timeline`) seed `defaultContent` with empty arrays, so the `(i === 0 ? testid)` placement in their editors never renders the canonical `module-editor-primary-text-input` until "Add" is clicked. Fix is a coin flip:
    - (a) seed one empty row in `ui/admin/lib/itemTypes/registry.ts` defaultContent, or
    - (b) extend the harness with an "add first row" helper per module.
    (a) preferred — also makes the editor less empty-feeling on first add. Unblocks 14 fixme tests (admin + public render for each).
17. **gqty schema regeneration** — `npm run generate-schema` against a live server with the updated `services/api/schema.graphql` (which now includes `IUser.kind`). Then drop the raw-fetch workaround in `services/api/client/UserApi.ts`. Probably also fixes the MCP `mcp-issue` / `mcp-revoke` flow (currently `fixme` — gqty client likely has the same kind of stale field). 2 fixme tests reinstated.
18. **BlogFeed primary-text-input behind closed `<Collapse>`** — move the testid out of the More-options collapse, OR have the harness expand the collapse before fill. 1 fixme test.
19. **Themes (was ROADMAP #13 in the original list)** — when `Theme.tsx` mounts as a direct page route under `/admin/client-config/themes`, `gqty.resolve(({query}) => query.mongo.getThemes)` returns empty even though a raw `fetch('/api/graphql')` against the same query returns the 10 seeded themes. Worked under the legacy `/admin/settings` tabbed shell. Likely fixed alongside #17 (codegen drift), but if not, needs its own gqty client-init investigation. Smoke step 7 + `themes.spec.ts` (2 tests) reinstate.
20. **ProductApi mock → real resolvers** — `services/api/client/ProductApi.ts` is currently a stub returning empty arrays / "not implemented" errors because `getProducts` / `saveProduct` / `searchProducts` / `setProductPublished` aren't on the GraphQL schema yet. Implement the resolvers (mirror PostService shape per the ecommerce/products spec) + regenerate gqty + drop the stub. Promotes 5 surface-mount specs (`products`, `cart`, `checkout`, `inventory`, `orders`) to real authoring + flow specs.
21. **Customer signup auto-signin** — `signUpCustomer` mutation persists the user, but the immediate `signIn('customer-credentials', …)` after it returns `{ok: false}` and bounces to `/account/signin?callbackUrl=…`. The follow-up explicit signin works (proves credentials are valid). Likely a same-request session-cookie timing issue inside NextAuth credentials provider; not blocking — the user still ends up signed in via the bounce — but worth investigating before customer-auth UX polish. No fixme test currently.
22. **Blog posts editor testids** — admin authoring at `/admin/content/posts` needs `posts-new-btn`, `posts-title-input`, `posts-slug-input`, `posts-save-btn` on `Posts.tsx`. 1 fixme test.
23. **Visual regression baselines** — picked up from #15. Curated set of public pages (`/`, `/blog`, each module rendered in isolation via `/admin/build/modules-preview`) get screenshot baselines committed under `tests/e2e/visual/__snapshots__/`. Update via `npm run e2e:update-screenshots` (already scripted). CI sharding: 4× chromium workers, nightly on `develop`, gate on merge to `main`.

### Admin UX (queued 2026-04-30)

24. [features/platform/admin-segregation.md](features/platform/admin-segregation.md) — collapse the 17+ admin tabs into **six concern areas**: Page building (`/admin/build`), Client configuration (`/admin/client-config` — themes, logo, layout mode), Content management (`/admin/content`), SEO (`/admin/seo` — including per-page SEO consolidated here), Versioning · publishing · auditing (`/admin/release`), Admin side management (`/admin/system` — users, MCP, inquiries). No functionality moves; only navigation hierarchy changes. Phased rollout: additive routes (zero behavior change) → top-bar restructure → drop old URLs after two release cycles. Pairs with [features/platform/admin-ui-modes.md](features/platform/admin-ui-modes.md) — simplified mode then maps cleanly to "show only the area's primary action," advanced mode shows the full sub-nav.

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

### Go-to-market

| Item | Status |
|---|---|
| Onboarding flow — first-run wizard for new installs (site name, admin account, theme pick) | Planned |
| Documentation — setup, feature reference, AI/MCP workflow guide | Planned |
| Landing page — explains the AI angle, positions against Contentful / Builder.io, pricing | Planned |

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
