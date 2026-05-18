---
name: products-as-composable-page
description: Refactor `/products`, `/products/[category]`, `/products/[category]/[subcategory]/...` into the standard CMS `IPage` framework. Warehouse-sourced products auto-populate a virtual page tree the same way operator-authored pages do — categories become pages, sub-categories become sub-pages, individual products become leaf pages. Removes the current 3-layer sub-page depth cap (categories often need 4-6 levels: `Electronics → Phones → Smartphones → Apple → iPhone 15 → Pro Max`). Operators get the full section-composable surface (Hero, CategoryGrid, FilterBar, ProductGrid, FAQ, NewsletterCta, etc.) on every category page; defaults ship sensibly so a zero-config warehouse import renders a working catalogue.
---

# Products as a composable page

> **UX polish — 2026-05-16.** Storefront detail + listing UX upgraded on
> top of the composable-page architecture: `/products/[slug]` rebuilt
> with brand row + category chips + VAT label + spec `<Table>` from
> `attributes` + "About this item" card + yellow pill add-to-cart;
> `/products/index.tsx` initially gained wide-search + sort + category
> chips (later partly superseded by W6b `FacetedFilterPanel` after the
> develop ↔ test-lEADs merge); new `/products/category/[slug].tsx`
> 1-level-deep landing page. Admin nav flags
> `commerce.nav.productsEnabled` + `commerce.nav.productsCategoriesAsSubnav`
> defined in `commerceFlags.ts`. Placeholder image resolver added at
> `ui/client/lib/productImage.ts`. See
> [shipped.md 2026-05-16 storefront UX polish](../shipped.md).

## Goal

Make the products catalogue a first-class composable page in the CMS, not a hand-coded `/products` route. Warehouse-sourced inventory (W7b ss.com adapter, future Shopify / WooCommerce / DIY adapters) auto-populates an `IPage` tree where:

- `/products` = the root catalogue page (composable; ships with default section layout)
- `/products/cars` = a category page (auto-created when warehouse data has the `cars` category)
- `/products/cars/used` = sub-category page (auto-created)
- `/products/cars/used/sedan/bmw/3-series` = N-deep sub-page; current 3-layer limit removed
- `/products/cars/used/sedan/bmw/3-series/2018-bmw-330i-xdrive` = leaf product page (auto-created)

**Each level is an `IPage`** — operators can edit its sections, add a hero, attach an FAQ, override the auto-generated product grid with custom curation, etc. The page framework handles the same way authored pages do: revalidation, sitemap contribution (W8h), SEO meta, hreflang per language, redirect handling.

**Sub-page depth cap removed.** Today `IPage.parent` traversal is capped at 3 levels (a structural limit baked into the navigation builder). Real product taxonomies routinely go 4-6 levels deep (`Outdoor → Camping → Tents → 4-Season → Mountain → Hilleberg`). The cap is removed; renderers + admin shell + sitemap + breadcrumb composer all walk N-deep.

## Why now

- **Wave 7b shipped `IProduct.source = 'warehouse'` + adapter system + ss.com cars adapter — but the storefront surface is hand-coded `/cars` + `/cars/[slug]` pages.** That worked for a single vertical but doesn't generalize. Shopify, WooCommerce, DIY warehouses each shipping their own bespoke `/<vertical>` route is a path to N parallel codebases.
- **The CMS already has section composition.** Sections render into pages via `SectionContent.tsx`. Reusing the page framework for warehouse-derived catalogue pages means operators get inline editing (W2.5 inline-editing), Sonner toasts, drag-reorder, MCP coverage parity, SEO defaults, theme styling — for free.
- **3-layer cap was an early-stage assumption.** When the project shipped, pages were a hand-authored medium and 3 levels was generous. Auto-derived category trees are a different shape; the cap is now load-bearing-wrong.
- **Mirrors product-module-and-checkout-customization design philosophy.** That item ships a `Product` module composable into any page. This item makes the catalogue page itself composable. Together they form the full operator surface: featured products inside marketing pages (`Product` module), full catalogue pages (this item).
- **Checkout-as-composable-page is the sibling item.** Both treat formerly-hardcoded storefront surfaces as composable pages. Same framework reuse argument.

## Design

### Virtual `IPage` tree from warehouse data

When the operator imports warehouse data (W7b adapter, or any future adapter), a derived-page tree is generated:

```
/products                            (root, manual or auto-created)
├── /products/cars                   (category page, auto from product.category='cars')
│   ├── /products/cars/used          (sub-category, auto from product.subcategory='used')
│   │   ├── /products/cars/used/sedan
│   │   │   ├── /products/cars/used/sedan/bmw
│   │   │   │   ├── /products/cars/used/sedan/bmw/3-series
│   │   │   │   │   └── /products/cars/used/sedan/bmw/3-series/2018-330i-xdrive   ← leaf product
│   │   │   │   └── /products/cars/used/sedan/bmw/5-series
│   │   │   └── /products/cars/used/sedan/audi
│   │   └── /products/cars/used/suv
│   └── /products/cars/new
├── /products/electronics            (next category)
│   └── ...
└── ...
```

Each node is an `IPage` row in Mongo with:

- `slug: 'cars'` (relative to parent)
- `parent: '<parent-page-id>'` (or `null` for root)
- `source: 'warehouse-derived' | 'manual'` — discriminator. Operator-authored pages stay `'manual'`.
- `derivedFrom: { adapter: 'ss-com-cars', category: 'cars', filter: {...} }` — when `source: 'warehouse-derived'`, points at which adapter + filter rebuilds this page
- `sections: ISection[]` — same shape as authored pages. For warehouse-derived pages, defaults to a sensible layout (Hero with category name + breadcrumb, FilterBar, ProductGrid) that operators can override.
- `seo: ISeo` — operators can override; defaults to `<title>{categoryName}</title> + <description>` auto-generated from category metadata

### `IPage.depth` is now unbounded

- Drop the hardcoded 3-layer cap in `NavigationService.replaceUpdateNavigation` + `loadNavigationPages.ts` + every consumer that walks ancestry
- Add a soft warning at depth > 8 in the admin pane (operator-tunable in `siteFlags.maxPageDepth`, default `null` = unbounded with depth-8 warning)
- Breadcrumb composer walks the full ancestry (no cap)
- Sitemap contributor (W8h) emits all depths
- Page slug resolution (`gqlFetch.ts` / `[...slug].tsx`) walks N-deep
- Internal-link auto-301 on slug change (W8h polish) walks N-deep
- Admin shell tree-view navigation needs virtualization at deeper levels (lazy-render children on expand)

### Auto-population worker

`services/features/Pages/WarehousePageSyncWorker.ts` (new):

1. Cron-fires every 5 min (or on-demand via MCP `pages.warehouseSync.run`)
2. Walks each registered `IWarehouseAdapter`'s product list
3. Group products by `(category, subcategory, attributes.make, attributes.model, ...)` — adapter declares which attribute keys form the hierarchy
4. Diff against the existing `IPage` tree where `source: 'warehouse-derived'`
5. Insert new pages for new branches; update existing pages' `derivedFrom.lastSyncedAt`; mark deleted branches with `cascadeDelete('pages', ...)` after the warehouse-side product is gone for ≥24h (uses existing W7b cascade machinery)
6. Each page write goes through the existing `idempotencyKey` pattern so re-running the worker is safe
7. **Operator overrides preserved** — if a warehouse-derived page has been edited (`page.sections` modified beyond the auto-template), the worker only updates the derived-data fields (`derivedFrom.lastSyncedAt`, the auto-injected ProductGrid section's filter), never the operator-added sections

### Auto-template per category page

When a warehouse-derived page is first created, it gets a default section layout from `services/features/Pages/CategoryTemplate.ts`:

1. **Hero** (compact, mode: `bg`) — category name + count badge (`"123 cars in this category"`)
2. **Breadcrumb** (W5.5a shared module) — auto-generated from `parent` chain
3. **FilterBar** (W6b faceted filter system; ship in parallel) — filters derived from product `attributes` schema
4. **ProductGrid** (this section uses the `Product mode=grid` module from product-module-and-checkout-customization) — bound to the page's `derivedFrom.filter`
5. **Pagination** — server-side cursor-based; loads more on scroll OR explicit "Load more" CTA
6. **NewsletterCta** (optional, opt-in per category)

Operators can:

- Reorder sections via the standard section reorder UI
- Add custom sections (Hero in `image` mode, FAQ, RichText, Testimonials, ContactForm, anything)
- Replace the auto-ProductGrid's filter with a curated product list (e.g., "Bestsellers in Cars" instead of all cars)
- Delete the auto-template entirely and compose from scratch (the worker won't re-inject — once `sections[]` differs from the auto-template fingerprint, the page is "operator-managed")

### Leaf product page

Each individual product also gets an `IPage` row:

- `slug: <product-slug>`
- `source: 'warehouse-derived'`
- `derivedFrom: { adapter, productId }`
- Auto-template:
    1. **ProductDetailHero** (new module — image gallery + title + price + Buy CTA + VAT badge from W8g)
    2. **ProductSpecTable** (auto-generated from `IProduct.attributes`)
    3. **ProductDescription** (RichText, sourced from `IProduct.description`)
    4. **ProductRelated** (Product module mode=related, auto-populated)
    5. **Reviews** (optional, opt-in)
    6. **ContactForm** (when checkout is disabled OR product is `source: 'reservation-only'` per W7b)

Operators can override exactly the same way as category pages.

### MCP coverage parity

New tools:

- `pages.warehouseSync.run { adapterId? }` — manually trigger the sync (operator + scheduled)
- `pages.warehouseSync.status` — last-sync time + counts (created / updated / cascaded-delete)
- `pages.warehouseSync.preview { adapterId, dryRun: true }` — show what would change without writing
- `pages.depth.get { pageId }` / `pages.depth.set { pageId, maxDepth }` — for the soft-warning threshold
- Extends existing `page.list { includeWarehouseDerived }` flag (matches W8f introspection pattern)
- Extends `page.update` to gate edits on warehouse-derived sections (operator-added sections always editable; derived sections need explicit `overrideDerived: true` flag)

### Schema change — removing the 3-layer cap

Find every consumer of the cap:

- `services/features/Navigation/NavigationService.ts` — `replaceUpdateNavigation` validates depth; remove `if (depth > 3) throw` and replace with soft-warning emission to audit log when `depth > maxPageDepth` (configurable)
- `ui/admin/features/Navigation/Layout.tsx` — tree-view component caps expansion; remove cap, add lazy-render virtualization
- `ui/client/features/Footer/SiteFooter.tsx` — auto-nav generation walks N-deep
- `services/features/Seo/sitemapContributors.ts` (W8h) — pages contributor walks N-deep
- `services/features/Anchors/AnchorRegistry.ts` — anchor builder walks N-deep
- `ui/client/pages/[...slug].tsx` getStaticPaths — N-deep slug resolution
- `next.config.js` — if any rewrites depend on path-segment count, generalize
- MCP `page.create / update` — drop depth validation; emit soft warning

### Performance considerations

N-deep pages with a large catalogue can mean tens of thousands of pages. Mitigations:

- **getStaticPaths uses `fallback: 'blocking'`** — pages render on first hit, subsequent hits served from edge cache (W8d caching tier shipped 2026-04-24)
- **Sitemap index split** (W8h polish already shipped) — kicks in at >50k entries automatically
- **Admin tree-view lazy-loading** — only the visible-and-expanded subtree fetches
- **Breadcrumb walk caching** — `pageBreadcrumb(pageId)` result cached for 5 min; invalidated on page rename
- **Slug-resolution index** — Mongo compound index `(slug, parent)` ensures O(depth) slug-walk regardless of total page count

### Auto-301 on category rename (W8h SEO polish reuse)

The W8h SEO polish item already shipped auto-301 on slug change. When a warehouse-derived category renames upstream (e.g., adapter rename `cars/used/sedan` → `cars/pre-owned/sedan`), the worker:

1. Detects the slug change
2. Creates redirects from old to new (uses existing `redirectsService.create` — W8h CRUD already shipped)
3. Audit-logs the auto-rename
4. The middleware redirect-lookup endpoint (also W8h) consults the new redirect on next visit

### Pairs with product-module-and-checkout-customization

The category pages' auto-injected ProductGrid section uses the `Product` content module (mode=grid) from product-module-and-checkout-customization. That item is a strict dependency of this one — ship them as a sequence:

1. product-module-and-checkout-customization sub-jump A (Product module + variants)
2. THIS item's first sub-jump (virtual page framework + worker)
3. product-module-and-checkout-customization sub-jumps B/C/D (checkout customization)
4. THIS item's second sub-jump (leaf product pages + auto-301 hookup)

## Files to touch

### New files

- `shared/types/IPage.ts` — extend with `source: 'manual' | 'warehouse-derived'` + `derivedFrom: { adapter, productId?, category?, filter? }` + `lastSyncedAt`
- `services/features/Pages/WarehousePageSyncWorker.ts` — cron sync worker
- `services/features/Pages/CategoryTemplate.ts` — default section layout for warehouse-derived category pages
- `services/features/Pages/ProductDetailTemplate.ts` — default section layout for leaf product pages
- `services/features/Pages/PageTreeService.ts` — N-deep tree walking + breadcrumb composer (extracted from existing Navigation code; uncapped)
- `ui/client/modules/ProductDetailHero/` — new module (image gallery + title + price + Buy CTA + VAT badge)
- `ui/client/modules/ProductSpecTable/` — new module (auto-renders from `IProduct.attributes`)
- `ui/client/modules/Pagination/` — new module (cursor-based; load-more or infinite-scroll variants)
- `ui/admin/features/Pages/WarehouseSyncPanel.tsx` — operator pane showing sync status, manual-trigger button, dry-run preview, last-error display
- `services/features/Mcp/tools/warehouseSync.ts` — new MCP tools
- `tests/e2e/storefront/warehouse-page-tree.spec.ts` — happy path: import warehouse, verify tree pages exist, verify breadcrumbs work N-deep
- `tests/e2e/storefront/operator-override-persists.spec.ts` — operator edits a category page, worker re-runs, edits preserved
- `docs/runbooks/warehouse-page-sync.md` — operator runbook
- `docs/architecture/page-tree-depth.md` — design doc on the cap removal + perf considerations

### Modified files

- `services/features/Navigation/NavigationService.ts` — remove `depth > 3` validation; emit soft warning above `maxPageDepth`
- `services/features/Navigation/loadNavigationPages.ts` — N-deep walker
- `services/features/Seo/sitemapContributors.ts` — pages contributor walks N-deep + skips operator-deleted derived pages
- `services/features/Seo/SiteFlagsService.ts` — add `maxPageDepth?: number` (default null = unbounded with depth-8 warning)
- `services/features/Anchors/AnchorRegistry.ts` — anchor builder walks N-deep
- `ui/client/pages/[...slug].tsx` — N-deep slug resolution; getStaticPaths uses `fallback: 'blocking'`
- `ui/client/features/Header/SiteHeader.tsx` — nav builder walks N-deep with lazy expansion
- `ui/admin/features/Navigation/Layout.tsx` — tree-view virtualized + lazy-render children
- `ui/admin/features/Navigation/AddNewDialogNavigation.tsx` — depth picker uncapped (just emits warning above 8)
- `services/features/Mcp/tools/pages.ts` — drop depth validation; add `includeWarehouseDerived` flag to `page.list`
- `services/features/Mcp/tools/index.ts` — register `WAREHOUSE_SYNC_TOOLS`
- `ui/admin/lib/loaders/adminUILoaderRegistry.ts` — register WarehouseSyncPanel
- `services/themes/{editorial,agency,commerce}/module-styles.scss` — per-theme styling for new modules (Pagination, ProductDetailHero, ProductSpecTable)
- `tools/scripts/mcp-schema-drift.mjs` — recognize new bulk-write tools

## Acceptance

1. `IPage.source = 'warehouse-derived' | 'manual'` discriminator landed
2. Sub-page depth cap removed everywhere: schema validation, admin tree-view, sitemap, breadcrumb composer, anchor registry, slug resolution
3. `WarehousePageSyncWorker` runs every 5 min, builds the page tree from `IWarehouseAdapter` outputs, preserves operator overrides
4. Default category-page section layout renders (Hero + Breadcrumb + FilterBar + ProductGrid + Pagination + optional NewsletterCta) without operator intervention
5. Default leaf-product-page section layout renders (ProductDetailHero + ProductSpecTable + ProductDescription + ProductRelated + optional Reviews + ContactForm)
6. Operator editing a derived page's sections persists; subsequent worker runs preserve the operator edits and only touch `derivedFrom.lastSyncedAt`
7. Slug rename on warehouse side auto-creates a redirect via existing `redirectsService` (W8h) and middleware redirect-lookup honors it
8. MCP tools (`pages.warehouseSync.run / status / preview / depth`) all callable
9. Performance: N-deep slug resolution is O(depth) via Mongo compound index; admin tree-view virtualizes at expansion; 10k+ derived pages don't blow up sitemap generation (split kicks in)
10. 2 e2e specs green: warehouse-page-tree, operator-override-persists
11. Operator runbook published with: how the worker runs, how to opt out of auto-sync, how to override the auto-template, what happens when a warehouse product disappears
12. Pairs with product-module-and-checkout-customization: the auto-injected ProductGrid section uses the `Product mode=grid` module, not a parallel implementation

## Effort

**XL · ~3-4 days AI** — recommend splitting into 3 sub-jumps per §13:

- **Sub-jump A** — sub-page depth cap removal + N-deep schema + slug-resolution + sitemap walk + admin tree-view lazy-render (~1.5 days)
- **Sub-jump B** — `WarehousePageSyncWorker` + `CategoryTemplate` + `ProductDetailTemplate` + new modules (ProductDetailHero, ProductSpecTable, Pagination) + WarehouseSyncPanel + MCP tools (~2 days)
- **Sub-jump C** — auto-301 hookup + operator-override preservation + e2e specs + runbook (~0.5 days)

## Dependencies

**Hard:**

- product-module-and-checkout-customization sub-jump A (the `Product` module is consumed by the auto-injected ProductGrid section)
- W6b faceted filter system (the auto-injected FilterBar section's facet config)
- W7b ss.com adapter (proves the `IWarehouseAdapter` contract this item consumes)

**Soft (already shipped):**

- W5 themes infrastructure → per-theme `module-styles.scss` slot for new modules
- W8h SEO program (core + polish) → sitemap contributors, auto-301 on slug change, redirects CRUD all already in place
- W8g multi-currency + tax → `<PriceDisplay>` + VAT badge on leaf product page
- W2.5 inline editing → 8/24 modules instrumented; new modules in this item should add `data-edit-target` attrs from the start

## Open questions

1. **What about non-warehouse "manual" product pages?** Operators may want to author one-off "limited edition" product pages without a warehouse source. The schema supports it (`source: 'manual'`); the question is whether the same auto-template gets injected by default. Recommended: operator creates a blank page + drags in the `Product mode=featured` module manually. Auto-template only fires on `source: 'warehouse-derived'`.
2. **Multi-language category names.** Categories often have language-specific names (`/products/cars` in English vs `/produkti/automasinas` in Latvian). The existing i18n page-slug system handles this; the worker writes one `IPage` per language-slug pair when the adapter provides translations, falls back to English when it doesn't.
3. **Adapter-side category schema.** Each adapter declares which attribute keys form the hierarchy (`['category', 'subcategory', 'make', 'model']` for cars; `['category', 'subcategory', 'brand']` for general retail). Out of scope for this jump: making that schema declarable in the admin UI rather than in adapter code. Acceptable to ship with the schema living in the adapter for now.
4. **Page deletion behavior.** If a warehouse product is removed, do we hard-delete its leaf page or soft-delete to `.trash`? Recommended: soft-delete with 24h TTL (matches existing `cascadeDelete.ts` cascade machinery from W7b cars). If the product comes back within 24h, restore is automatic.

## Out of scope

- **Editorial control over which warehouse products surface.** The worker imports everything; operators can manually unpublish (soft-delete) individual products. A curation pane ("Don't auto-create pages for products under $10") is a follow-up item.
- **Per-tenant category-tree configuration.** Today the adapter dictates the hierarchy. Per-site operator overrides are out of scope.
- **Search across the derived tree.** Existing `/search` page already covers product search; integrating with the new page tree is a follow-up.
- **Translation auto-generation for category names.** If the adapter doesn't provide a Latvian name for `Cars > Used > Sedan`, operators manually translate via the existing i18n flow.

## Visual reference

### Category page (`/products/cars/used`)

```
┌────────────────────────────────────────────────────┐
│  USED CARS                                  123    │  ← Hero
│  Cars > Used                                       │  ← Breadcrumb
├────────────────────────────────────────────────────┤
│  Make ▾  Model ▾  Year ▾  Price ▾  Body ▾         │  ← FilterBar (W6b)
├────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │ BMW  │  │ Audi │  │ VW   │  │ Skoda│           │  ← ProductGrid
│  │ 330i │  │ A4   │  │ Golf │  │ Octv │           │     (Product mode=grid)
│  │ €15k │  │ €18k │  │ €12k │  │ €10k │           │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
│  ...                                               │
├────────────────────────────────────────────────────┤
│        [ Load more → ]                             │  ← Pagination
├────────────────────────────────────────────────────┤
│  Subscribe to new arrivals in Used Cars            │  ← NewsletterCta (opt)
│  [ email________ ] [ Subscribe ]                   │
└────────────────────────────────────────────────────┘
```

### Leaf product page (`/products/cars/used/sedan/bmw/3-series/2018-330i-xdrive`)

```
┌────────────────────────────────────────────────────┐
│  [Image Gallery]    2018 BMW 330i xDrive          │
│  [    1/12    ]     Used · Sedan                  │
│  [   ←    →   ]     €15,400                       │  ← ProductDetailHero
│                     VAT included · Reverse-charge │
│                     [ Reserve ] (W7b) or [Buy ]   │
├────────────────────────────────────────────────────┤
│  SPECIFICATIONS                                    │
│  ┌──────────────┬──────────────────┐               │
│  │ Year         │ 2018             │               │
│  │ Mileage      │ 84,000 km        │               │  ← ProductSpecTable
│  │ Fuel         │ Petrol           │               │
│  │ Transmission │ Automatic        │               │
│  │ ...          │ ...              │               │
│  └──────────────┴──────────────────┘               │
├────────────────────────────────────────────────────┤
│  Lorem ipsum description text from IProduct...     │  ← ProductDescription
├────────────────────────────────────────────────────┤
│  Related vehicles                                  │
│  [ BMW 320d ]  [ BMW 5-Series ]  [ Audi A4 ]      │  ← ProductRelated
│                                                    │     (Product mode=related)
├────────────────────────────────────────────────────┤
│  Reviews (opt) · Contact (when not buyable)        │
└────────────────────────────────────────────────────┘
```
