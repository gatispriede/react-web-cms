---
name: product-display-templates
description: Operator-defined `IProductTemplate` rows — named section compositions ("Premium", "Standard", "Quick-buy", "Bundle", "Lookbook") that products can be tagged with to control their leaf-product-page appearance. Each template is itself a list of sections (Hero, Gallery, SpecTable, RelatedProducts, Reviews, etc.) the operator composes once and reuses across N products. Products gain `IProduct.templateId?: string` — when present, the leaf product page renders using the template's section layout instead of the default. Library managed via a new admin pane (Product Templates) with full CRUD + preview-against-fixture + duplicate-template + per-template testid emission for e2e. Pairs with products-as-composable-page (which auto-generates leaf product pages) and the existing Product content module from product-module-and-checkout-customization.
---

# Product display templates — operator-configurable product appearance library

## Goal

Today the leaf product page (the page that displays one product — e.g., `/products/cars/used/sedan/bmw/3-series/2018-330i-xdrive`) renders with a single hardcoded section layout. The products-as-composable-page item already lets operators edit that layout **per-product**. But that's tedious when 500 products should share one layout, 50 flagship products should share a fancier one, and 10 commodity items should use a minimal layout.

Ship `IProductTemplate` — a named, reusable section composition that operators define **once** and apply to N products via `IProduct.templateId`. The template library replaces the per-product layout editing for the common case (operators still get per-product override for the exceptional case).

Examples (each is itself a composition of existing modules):

- **"Premium"** — `ProductDetailHero (image left, large gallery) + RichText (long story) + ProductSpecTable + LargeGallery + Reviews + ProductRelated (mode=related)`
- **"Standard"** — `ProductDetailHero (compact) + ProductSpecTable + ProductDescription + ProductRelated`
- **"Quick-buy"** — `ProductDetailHero (minimal, prominent CTA) + ProductSpecTable (collapsed) + ProductRelated`
- **"Bundle"** — `ProductDetailHero + RichText + SubProductsGrid (sibling products visible) + Reviews`
- **"Lookbook"** — `LargeGallery (image-led) + RichText (story) + ProductSpecTable (minimal) + Buy CTA pinned bottom`

Operators compose templates in the admin pane using the same section editor they use for pages (existing pattern). Each template gets a name + thumbnail + description so operators picking a template for a product see what they'll get. Products with no `templateId` fall back to the default template (or the inherited category-page template, see Open question 4).

This is the **storefront analog of theme variations** — themes control site-wide look; templates control per-product-class look.

## Why now

- **The "every product page looks the same" problem is real.** Once a catalogue has 50+ products, hand-editing each leaf page is operationally impossible. Operators need to bucket products by visual treatment.
- **Products-as-composable-page makes leaf pages composable.** That's the necessary infrastructure for this item — leaf pages are now `IPage` rows with section lists. This item layers templated composition on top.
- **The Product content module covers in-page references but not leaf appearance.** product-module-and-checkout-customization shipped the `Product` module (featured/grid/carousel/comparison/related variants) — that's about featuring products INSIDE other pages. Separately, the leaf product page itself needs visual variety. These are complementary surfaces.
- **B2B vs B2C visual treatment.** A `company`-typed product page (think: industrial spec sheet, downloadable PDF, "request quote" CTA) looks fundamentally different from a `client`-typed page (lifestyle photography, reviews, social proof, "buy now" CTA). Templates let operators ship both visual languages on the same site.
- **Wave 7b cars vertical needs this immediately.** Used cars want a different leaf-page layout than new cars (mileage badge prominent + service-history section vs. spec-table-first + warranty-info section). Today operators copy/paste section trees per car. Templates eliminate the duplication.

## Design

### `IProductTemplate` schema

```ts
interface IProductTemplate {
    id: string;                              // stable, slug-friendly
    name: string;                            // i18n-aware: 'Premium', 'Standard', 'Quick-buy'
    description: string;                     // i18n-aware operator-facing summary
    thumbnailImageId?: string;               // optional preview image (operator picks from media library)
    audience: 'b2c' | 'b2b' | 'either';      // hint for operator filtering
    applicableTo: {
        categories?: string[];               // category slugs this template is appropriate for
        sources?: ('manual' | 'warehouse-derived')[];
    };
    sections: ISection[];                    // the actual layout (same shape as IPage.sections)
    builtIn: boolean;                        // true for ships-with-platform templates; false for operator-created
    createdAt: Date;
    updatedAt: Date;
    auditStamp: IAuditStamp;
    version: number;                         // optimistic concurrency
}

interface IProduct {
    // ...existing fields
    templateId?: string;                     // references IProductTemplate.id; null = default template
    templateOverrides?: Partial<ISection[]>; // per-product overrides on top of template (Open question 5)
}
```

Templates live in a new `ProductTemplates` Mongo collection. Predefined enums for `audience` and `applicableTo.sources`.

### Built-in templates (ships with platform)

Five built-in templates ship as JSON seeds (similar to the W5 first-class theme manifests):

- `built-in:premium` (audience: `either`)
- `built-in:standard` (audience: `either`) — default fallback when no template selected
- `built-in:quick-buy` (audience: `b2c`)
- `built-in:bundle` (audience: `either`)
- `built-in:b2b-spec-sheet` (audience: `b2b`) — composed for company-typed customers

Operators cannot delete built-in templates (same lock pattern as checkout system pages). They CAN duplicate them as starting points for custom templates ("Duplicate to edit").

### Admin pane — Product Templates

New `ui/admin/features/ProductTemplates/ProductTemplatesPanel.tsx`:

- List view (table): name + audience + applicable categories + products-using count + last-edited
- Detail view: name + description + thumbnail picker + section editor (reuses existing section editor from pages) + preview-against-fixture button
- Actions: Create new · Duplicate from built-in · Save · Preview · Delete (cascade-deletes resets all products using it to default; confirmation modal with count)
- Operator can drag-reorder sections within the template just like in a page
- Each template's section editor shows the same section types available on a page
- Sonner `notifyPromise` on save; `notifyDestructive` on delete with Undo
- testids per row + per template action button + per section in the editor

### Template picker on `IProduct` admin form

When an operator edits a product (`/admin/content/products/<id>`), the product form gains a "Display template" Select:

- Options enumerated from active `IProductTemplate.list` filtered by `applicableTo.categories` matching the product's category, `applicableTo.sources` matching the product's source, `audience` matching `siteFlags.defaultProductAudience` (or `either`)
- Default: "Default (Standard template)" — uses `built-in:standard`
- Selected template shows its thumbnail + name + description inline
- Predefined Select, not free text

When a product has `templateId` set, its leaf product page renders using that template's `sections` instead of the products-as-composable-page default category template.

### Render dispatch

The leaf product page renderer (in `ui/client/pages/products/[...slug].tsx` or the system-page renderer if checkout-as-composable-page has landed):

```ts
// 1. Resolve the product
const product = await ProductService.getBySlug(slug);

// 2. Resolve the template
const template = product.templateId
    ? await ProductTemplateService.get(product.templateId)
    : await ProductTemplateService.getBuiltIn('standard');

// 3. Resolve the page (operator-overridden sections take precedence)
const page = await PageService.getLeafProductPage(product.id);
const sections = page.sectionsOverridden
    ? page.sections                            // operator edited this product's page directly
    : applyTemplate(template.sections, product); // template's sections with product data bound in
```

When operator edits a product's leaf page directly (per-product override from products-as-composable-page), that takes precedence over the template. The template is the *default*; per-product is the *override*.

### Section data binding

Templates contain section types like `ProductDetailHero` and `ProductSpecTable`. These sections need product data to render. The renderer binds product data through a context:

```ts
<ProductContext.Provider value={{product, currency, vatRegime}}>
    {sections.map(s => <SectionContent section={s} />)}
</ProductContext.Provider>
```

Sections read product data from context. Operator-defined sections in the template (e.g., RichText) get the product data via standard slot substitution (`{{product.name}}`, `{{product.price}}` — already supported in RichText for similar use cases).

### Preview against fixture

In the template editor, a "Preview" button renders the template against a fixture product so operators see what it'll look like:

- Operator picks a fixture product from a dropdown (curated set: one of each `applicableTo.sources` + one each `audience` type)
- Preview opens in a new tab at `/admin/preview/template/<templateId>?product=<fixtureId>`
- Rendered as if it were a real leaf product page; admin shell hidden

### Operator-managed templates' lifecycle

- **Soft-delete with 24h grace** — deleted templates go to `.trash`; products using them flip to `built-in:standard` automatically on delete. Restore within 24h flips them back.
- **Cascading update** — updating a template's sections takes effect immediately for all products using it (no per-product re-publish required)
- **Versioning** — `IProductTemplate.version` increments per save; allows rollback in admin (existing audit-stamp pattern from cascade engine)

### MCP coverage

Match F8-bulk-introspection shape:

- `productTemplate.list { includeUsage?: boolean }` — list templates + optional product-count per template
- `productTemplate.get { id }`
- `productTemplate.create { name, audience, sections, ... }`
- `productTemplate.update { id, ... }`
- `productTemplate.duplicate { fromId, newName }`
- `productTemplate.delete { id }` (soft-deletes; cascades to products via reset to default)
- `productTemplate.preview { id, fixtureProductId? }` — server-renders + returns HTML snippet
- `product.template.set { productId, templateId }` — bulk-capable per F8 pattern (`{ items: [{productId, templateId}], ids: [productId], templateId }`)

### New modules (some already shipped, some new)

Already shipped (this jump consumes them):

- `ProductDetailHero` — shipped by products-as-composable-page
- `ProductSpecTable` — shipped by products-as-composable-page
- `ProductDescription` — RichText variant
- `ProductRelated` — `Product mode=related` from product-module-and-checkout-customization
- `Pagination` — products-as-composable-page

Net-new this jump:

- `LargeGallery` (`ui/client/modules/LargeGallery/`) — image-led layout for Lookbook + Premium templates (full-bleed gallery; mobile carousel)
- `SubProductsGrid` (`ui/client/modules/SubProductsGrid/`) — for Bundle template; renders sibling products under a parent product
- `DownloadablePdf` (`ui/client/modules/DownloadablePdf/`) — for B2B Spec Sheet; auto-renders product spec table as PDF download link (uses W8g VAT-compliant invoice rendering primitives)
- `WarrantyInfo` (`ui/client/modules/WarrantyInfo/`) — for B2B + new cars

Each new module is testid-instrumented from the start; per-theme `module-styles.scss` slot filled with minimal default styling.

### Per-theme template variations

Each first-class theme (W5 — editorial, agency, commerce + 5 deferred) ships per-theme styling for the 5 built-in templates. `services/themes/<slug>/product-templates.scss` (new) — overrides hero spacing, gallery border treatment, spec-table density, etc. per theme.

Operator-created custom templates inherit theme styling automatically.

### `defaultProductAudience` site flag

New `siteFlags.defaultProductAudience: 'b2c' | 'b2b' | 'either'` — drives:

- Default template applied to new products without explicit `templateId`
- Default audience filter when operator opens template picker on a product

### Auto-template assignment heuristics (deferred polish)

Initial ship: operator must explicitly set `templateId` on each product (default falls back to `built-in:standard`).

Future polish (out of scope): auto-assign template based on `IProduct.attributes.priceTier` or `IProduct.category` matching `applicableTo.categories`. Not in this jump.

## Files to touch

### New files

- `shared/types/IProductTemplate.ts`
- `services/features/ProductTemplates/ProductTemplateService.ts` — CRUD + cascade-on-delete + version
- `services/features/ProductTemplates/builtInTemplates.ts` — JSON seeds for the 5 built-in templates
- `services/features/ProductTemplates/ProductTemplatesServiceLoader.ts`
- `services/features/ProductTemplates/feature.manifest.ts`
- `ui/admin/features/ProductTemplates/ProductTemplatesPanel.tsx`
- `ui/admin/features/ProductTemplates/ProductTemplatesViewModel.ts`
- `ui/admin/features/ProductTemplates/ProductTemplateEditor.tsx`
- `ui/admin/features/ProductTemplates/ProductTemplatesAdminUILoader.ts`
- `ui/client/modules/LargeGallery/`
- `ui/client/modules/SubProductsGrid/`
- `ui/client/modules/DownloadablePdf/`
- `ui/client/modules/WarrantyInfo/`
- `ui/client/pages/admin/preview/template/[templateId].tsx` — preview-against-fixture page
- `services/features/Mcp/tools/productTemplates.ts`
- `services/themes/{editorial,agency,commerce}/product-templates.scss` — per-theme template styling
- `tests/e2e/admin/product-templates.spec.ts` — create / update / duplicate / delete / preview
- `tests/e2e/storefront/product-with-template.spec.ts` — happy path: assign template to product, leaf page renders with template's layout
- `docs/runbooks/product-templates.md`

### Modified files

- `shared/types/IProduct.ts` — add `templateId?: string` + `templateOverrides?: Partial<ISection[]>`
- `services/features/Modules/registry.ts` — register `EItemType.LargeGallery`, `EItemType.SubProductsGrid`, `EItemType.DownloadablePdf`, `EItemType.WarrantyInfo`
- `services/features/Seo/SiteFlagsService.ts` — add `defaultProductAudience`
- `services/features/Mcp/tools/products.ts` — extend `product.update` to accept `templateId`; add `templateId` to `product.list` introspection
- `services/features/Mcp/tools/index.ts` — register `PRODUCT_TEMPLATES_TOOLS`
- `ui/admin/lib/loaders/adminUILoaderRegistry.ts` — register `ProductTemplatesAdminUILoader`
- `ui/admin/features/Products/ProductForm.tsx` (or equivalent) — add template picker Select
- `ui/client/pages/products/[...slug].tsx` (or system-page renderer post-checkout-as-composable-page) — template-aware render dispatch
- `services/infra/cascadeDelete.ts` — register `productTemplates` parent feature; cascade resets products to default template
- `ui/admin/i18n/{en,lv}.json` — admin pane copy
- `ui/client/i18n/{en,lv}.json` (if exists; else inline) — built-in template names/descriptions

## Acceptance

1. `IProductTemplate` schema landed; `ProductTemplates` Mongo collection seeded with 5 built-in templates on first boot
2. Built-in templates marked `builtIn: true`; operators can duplicate but not delete
3. Operator can create + edit + duplicate + delete custom templates via admin pane
4. Each product gains a template picker; default falls back to `built-in:standard`
5. Leaf product page renders using the product's selected template's sections; per-product overrides (from products-as-composable-page) take precedence when present
6. Template editor uses the same section editor as page editing; supports drag-reorder + add-section + delete-section
7. Preview-against-fixture works: operator picks a fixture product, preview renders the template applied to that product
8. Soft-delete cascade: deleting a template sets all products using it to `built-in:standard`; Sonner Undo restores both
9. MCP tools (`productTemplate.list/get/create/update/duplicate/delete/preview`, `product.template.set` bulk) all callable
10. Per-theme template styling (5 built-in × 3 placeholder themes = 15 combinations) renders sensibly
11. 4 new modules (`LargeGallery`, `SubProductsGrid`, `DownloadablePdf`, `WarrantyInfo`) ship + testid-instrumented + per-theme styled
12. 2 e2e specs green
13. Operator runbook published: built-in templates explained + how to create custom + how `applicableTo` filters narrow the picker + cascade behavior on delete + audience semantics

## Effort

**L · ~6-8 hours AI** (assumes products-as-composable-page has shipped):

- `IProductTemplate` schema + service + cascade integration: ~1.5 h
- 5 built-in template JSON seeds + first-boot migration: ~1 h
- Admin pane (list + editor + preview button + duplicate + delete): ~2-3 h
- Template picker on product form: ~30 min
- Render dispatch in leaf product page: ~30 min
- 4 new modules (`LargeGallery`, `SubProductsGrid`, `DownloadablePdf`, `WarrantyInfo`): ~2-3 h
- Per-theme `product-templates.scss` (minimal default per theme): ~1 h
- MCP tools (8): ~1 h
- Section-data binding via `ProductContext`: ~30 min
- 2 e2e specs: ~30 min
- i18n + runbook: ~1 h

If products-as-composable-page hasn't shipped yet (no leaf-product-page renderer), add ~3-4 h for the leaf-page renderer scaffolding (overlaps with that item's scope).

## Dependencies

**Hard (in active queue, must land first):**

- products-as-composable-page — leaf product page renders via `IPage` framework; this item adds template-driven render dispatch on top
- product-module-and-checkout-customization — `Product` content module's mode=related variant consumed by `ProductRelated` section in built-in templates
- checkout-as-composable-page — system-page pattern + locked-section model is referenced (templates are NOT locked but the UX pattern is the same)

**Soft (already shipped):**

- W5 themes infrastructure — per-theme `module-styles.scss` slot for new modules
- W7b cars vertical — initial driver / proof point for B2B vs B2C template variation
- W8g multi-currency + tax — `<PriceDisplay>` in hero; W8g VAT-compliant PDF rendering for DownloadablePdf
- W2.5 inline editing — new modules instrumented with `data-edit-target` from the start (raises coverage)
- F8-bulk-introspection — pattern for `product.template.set` bulk MCP

## Open questions

1. **Template inheritance from category.** Should warehouse-derived category pages have a `defaultProductTemplateId` so all products in that category default to the same template? Reasonable yes, but adds complexity. Recommended: ship without category inheritance this jump; products use site-wide `defaultProductAudience`-driven default. Category-level defaults are a follow-up.
2. **Per-locale template variations.** Should operators be able to define different templates per language (e.g., Latvian + English versions of "Premium")? Recommended no — templates are language-agnostic; localized copy lives in RichText sections via existing i18n. Operators wanting language-specific layouts can use the per-product override.
3. **Operator-shared template library across tenants.** Multi-site operators might want one "Premium" template shared across all their sites. Out of scope this jump (current model is per-site).
4. **Default fallback chain.** If a product has no `templateId` AND its category page has no `defaultProductTemplateId` (future feature), fall back to `built-in:standard`. Document this clearly in the runbook.
5. **Per-product overrides on top of templates.** If operator picks template X for product A, then edits product A's leaf page directly to add a unique section, where does the override live? Options: (a) `IProduct.templateOverrides` — partial section diff that's applied on top of the template; (b) full leaf page override (operator edits the `IPage.sections` directly via products-as-composable-page, the templateId becomes informational only). Recommended: (b) — simpler model; operator-edited page wins outright. `templateOverrides` field in schema reserved for future use.
6. **Template thumbnails.** Operator picks a thumbnail image. Should the platform auto-generate one from the preview render? Recommended no — auto-thumbnail is a polish follow-up. Operator manually picks a representative image for now.

## Out of scope

- Auto-template selection based on product attributes (price tier, category match)
- Per-locale template variations
- Multi-tenant shared template library
- A/B testing of templates against product KPIs
- Auto-generated thumbnail previews
- Template marketplace / community-contributed templates
- Conditional sections based on product attributes (e.g., "show WarrantyInfo only when warranty > 0 years") — operators get static sections; conditional rendering is a follow-up

## Visual reference

### Template editor (admin)

```
┌────────────────────────────────────────────────────────────┐
│  Product Templates › Premium                               │
│  [ Save ] [ Preview ] [ Duplicate ] [ Delete ]            │
├────────────────────────────────────────────────────────────┤
│  Name:           Premium                                   │
│  Description:    Large hero + story + gallery. For flagship│
│  Audience:       (◉) Either ( ) B2C ( ) B2B               │
│  Categories:     [+ Cars] [+ Watches] [+ ...]              │
│  Thumbnail:      [📷 pick from media library]              │
├────────────────────────────────────────────────────────────┤
│  Sections:                                                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ⋮ ProductDetailHero (mode: large image left)         │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ⋮ RichText (story, slot: product.description)        │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ⋮ LargeGallery (auto from product.images)            │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ⋮ ProductSpecTable (all attributes)                  │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ⋮ Reviews (when present)                             │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │ ⋮ ProductRelated (mode=related, rule: same-category) │ │
│  └──────────────────────────────────────────────────────┘ │
│  [ + Add section ]                                         │
├────────────────────────────────────────────────────────────┤
│  Used by 47 products                                       │
└────────────────────────────────────────────────────────────┘
```

### Product form with template picker

```
┌────────────────────────────────────────────────────────────┐
│  Products › 2018 BMW 330i xDrive                           │
│  [ Save ] [ Publish ] [ Duplicate ]                       │
├────────────────────────────────────────────────────────────┤
│  Name:           2018 BMW 330i xDrive                      │
│  Slug:           2018-330i-xdrive                          │
│  Category:       Cars > Used > Sedan > BMW > 3-Series      │
│  Price:          €15,400                                   │
│                                                            │
│  ─ APPEARANCE ─────────────────────────                    │
│  Display template:  [ Premium ▾ ]                          │
│  ┌──────────────────────────────────────┐                  │
│  │ 📷 Premium                            │                  │
│  │ Large hero + story + gallery. For    │                  │
│  │ flagship vehicles.                   │                  │
│  │ Used by 47 products                  │                  │
│  └──────────────────────────────────────┘                  │
│  [ Customize this product's page → ] (per-product override)│
│                                                            │
│  ...                                                       │
└────────────────────────────────────────────────────────────┘
```
