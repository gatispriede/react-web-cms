# Architecture — Product Display Templates

Phase 1.F. Design notes for the `IProductTemplate` system.

## Why templates

Per-product leaf-page editing (products-as-composable-page) is
operationally untenable at catalogue scale. Templates let operators
bucket products by visual treatment and edit each treatment **once**.

Templates are the storefront analog of themes:
- Themes control site-wide look (typography, palette, density).
- Templates control per-product-class look (section composition).

## Schema split

`IProductTemplate` (new) lives in `shared/types/IProductTemplate.ts`:
- `id` — `built-in:<slug>` for platform; `custom-<guid>` for operator.
- `sections: ISection[]` — same shape as `IPage.sections`.
- `builtIn: boolean` — platform-owned, undeletable when true.
- `version: number` — OCC counter; service rejects stale updates.
- `audience` / `applicableTo` — picker filters.

`IProduct` (extended in `shared/types/IProduct.ts`):
- `templateId?: string` — pointer; unset → default fallback.
- `templateOverrides?: Partial<unknown>[]` — reserved; today operators
  override via direct `IPage.sections` edits on the leaf product page.

## Resolution at render time

`resolveProductLeafSections` (`services/features/Pages/`) is the single
seam. Order:

1. Look up the template — `product.templateId` if set, else
   `built-in:standard` fallback via `getOrDefault`.
2. Compute the page's section fingerprint and compare to the
   template's (using the same `fingerprintProductDetailTemplate`
   helper Phase 1.C introduced).
3. **Per-product override wins** when the fingerprints differ —
   operator-edited `IPage.sections` render directly.
4. Otherwise return `applyTemplate(template, product)` — a deep clone
   of the template's sections.

Data binding flows via `<ProductContext.Provider value={{product,
currency, vatRegime}}>` set by the leaf-page renderer; child modules
(LargeGallery, SubProductsGrid, DownloadablePdf, WarrantyInfo,
ProductDetailHero, ProductSpecTable, …) read product via
`useContext(ProductContext)`. The context defaults to `null` so
modules degrade gracefully when an operator drops them on a non-
product page.

## Cascade-delete

When an operator deletes a custom template,
`ProductTemplateService.cascadeOnDelete` unsets `IProduct.templateId`
on every product referencing it, so those products fall back to
`built-in:standard` on the next render. Built-ins reject delete; the
service raises rather than silently no-op'ing.

The cascade does **not** route through `services/infra/cascadeDelete.ts`
(the trash-based engine) — templates have no soft-delete / restore
semantics today. Adding trash parity is a follow-up.

## Built-in seeding

`ProductTemplatesServiceLoader.onBoot` calls
`ProductTemplateService.seedBuiltIns`, which upserts every entry in
`builtInTemplates.ts` idempotently. The upsert overwrites built-ins'
`sections` on every boot so platform updates land without operator
action. Custom rows (`builtIn: false`) are never touched.

Built-ins as JSON seeds keeps the platform's default treatments
declarative — operators see exactly what they'd see post-duplicate
when they edit a customised copy.

## Module additions

Four new modules ship with this jump, registered in both halves of
the module registry split:

- `LargeGallery` — image-led full-bleed gallery; mobile carousel.
- `SubProductsGrid` — sibling-products grid under a parent product.
- `DownloadablePdf` — auto-rendered spec sheet PDF download link.
  Today's renderer points at `/api/products/<id>/spec-sheet.pdf`;
  the route handler is a follow-up that consumes W8g's VAT-compliant
  invoice rendering primitives.
- `WarrantyInfo` — warranty terms display.

Each follows Hero's 5-file shape (Component / .types / .scss / index)
plus a `PlaceholderJsonEditor`-backed admin editor under
`_ProductPageModules`.

## Future extensibility

- **Auto-template selection** by `product.attributes.priceTier` /
  category match — deferred.
- **Per-locale template variations** — out of scope; localized copy
  lives in RichText sections via existing i18n.
- **Soft-delete + 24h trash** parity with the page cascade engine.
- **Section editor on the template detail view** — today operators
  add/edit sections on the leaf product page, which then becomes a
  per-product override; a dedicated template-level section editor
  is a follow-up.
- **Category-page `defaultProductTemplateId`** — templates inherited
  from the category container; deferred per spec open question 1.

## Cross-links

- Spec — `docs/roadmap/storefront/product-display-templates.md`
- Runbook — `docs/runbooks/product-templates.md`
- Phase 1.C — `docs/roadmap/storefront/products-as-composable-page.md`
- Phase 1.B — `docs/roadmap/storefront/product-module-and-checkout-customization.md`
