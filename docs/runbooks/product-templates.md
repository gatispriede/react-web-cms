# Runbook — Product Display Templates

**Status:** Phase 1.F (product-display-templates). Operator-facing.

## What it is

`IProductTemplate` rows are named, reusable section compositions
operators apply to N products via `IProduct.templateId`. Instead of
hand-editing every leaf product page, operators bucket products by
visual treatment ("Premium" / "Standard" / "Quick-buy" / "Bundle" /
"B2B Spec Sheet") and the storefront renders the right layout
automatically.

## Built-in templates (5)

Seeded on first boot, refreshed on every subsequent boot:

| Id                          | Audience | When to use                                                  |
|-----------------------------|----------|--------------------------------------------------------------|
| `built-in:premium`          | either   | Flagship products — large hero + story + gallery + spec      |
| `built-in:standard`         | either   | Default fallback when no `templateId` is set                 |
| `built-in:quick-buy`        | b2c      | Commodity items where Buy CTA prominence wins                |
| `built-in:bundle`           | either   | Parent products with visible sibling sub-products            |
| `built-in:b2b-spec-sheet`   | b2b      | Industrial spec + warranty + downloadable PDF                |

Built-ins **cannot be deleted** — the service rejects `delete` when
`builtIn: true`. Operators duplicate them as starting points for
custom templates (admin pane → "Duplicate", or
`productTemplate.duplicate` over MCP).

## Creating a custom template

Admin pane: **Content → Product templates → Create custom template**.

1. Enter a name + audience (`b2c` / `b2b` / `either`).
2. Click **Create**.
3. The new row appears under built-ins; pick it to edit metadata.
4. Section editing happens on a leaf product page for now (section
   editor on the template detail view itself ships in a follow-up).

## Assigning a template to a product

The product admin form (Phase 1.F follow-up — wire-up tracked
separately) exposes a "Display template" Select. Until that ships,
assign via MCP:

```
product.template.set { productId: "...", templateId: "built-in:premium" }
```

Bulk assignment via the F8-shape:

```
product.template.set { ids: ["p1","p2","p3"], templateId: "custom-..." }
product.template.set { items: [{productId, templateId}, ...] }
```

Setting `templateId: null` (or omitting it) clears the assignment, so
the product falls back to `built-in:standard`.

## `applicableTo` filters

When set, the template-picker narrows the option list to relevant
products only:

- `applicableTo.categories: ["cars/used"]` — appears only for products
  in that category tree
- `applicableTo.sources: ["warehouse"]` — appears only for
  warehouse-derived products

Empty/unset = "applies to everything".

The picker also filters by **audience** against
`siteFlags.commerce.defaultProductAudience` (when set; defaults to
`either` ⇒ no filter).

## Cascade behaviour on delete

Deleting a custom template:

1. Rejects when `builtIn: true`.
2. Looks up every `IProduct` with `templateId === <deleted id>`.
3. **Unsets `templateId` on each** so the default fallback
   (`built-in:standard`) renders for those products on the next page
   render.
4. Returns `{cascadedProducts: <count>}` so the admin pane's Sonner
   toast can surface the impact ("Deleted — 47 product(s) reset to
   default").

The cascade is **not reversible** today — there is no soft-delete /
trash flow for templates yet. A follow-up jump will add `.trash` +
24h restore parity with the page cascade engine.

## Render resolution (for debugging)

The leaf product page renderer dispatches via
`resolveProductLeafSections(product, page, templateService)`:

1. **Per-product override wins** — if `IPage.sections` for the leaf
   page differs structurally from the template's section fingerprint
   (operator edited the leaf page directly via products-as-composable-
   page), those sections render.
2. Otherwise the template's sections render, bound to the product via
   `<ProductContext>`.

To inspect what would render:

```
productTemplate.preview { id: "<templateId>", fixtureProductId: "<productId>" }
```

Or visit `/admin/preview/template/<templateId>?product=<productId>` for
a server-rendered preview with the admin shell hidden.

## MCP surface (8 tools)

- `productTemplate.list` — `{includeUsage?: boolean}`
- `productTemplate.get` — `{id}`
- `productTemplate.create` — `{name, audience, sections, ...}`
- `productTemplate.update` — `{id, ...patch, expectedVersion?}`
- `productTemplate.duplicate` — `{fromId, newName}`
- `productTemplate.delete` — `{id}` (cascade resets products)
- `productTemplate.preview` — `{id, fixtureProductId?}`
- `product.template.set` — single + F8-bulk

## Common operational scenarios

**Q: I want every car in Used > Sedan to use my custom "Used Cars"
template.**
1. Duplicate `built-in:standard` and rename to "Used Cars".
2. Bulk-assign via `product.template.set {ids: [...], templateId: ...}`
   using the product list filtered by category.

**Q: I deleted a template by mistake — how do I restore?**
There's no UI undo yet. Recreate the template (or duplicate from a
built-in) and re-assign products via `product.template.set` bulk. A
soft-delete + 24h trash flow is on the roadmap.

**Q: My template doesn't show in the picker for product X.**
Check `applicableTo.categories` / `applicableTo.sources` /
`audience` against product X's category / source / the site's
`defaultProductAudience` flag. Tighten or empty the filter to widen
the picker.

**Q: How do I update a built-in template's sections?**
Duplicate it, edit the copy. Built-ins refresh from the platform seed
on every boot — direct edits would be overwritten.
