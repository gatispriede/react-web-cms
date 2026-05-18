# Product module — architecture

Phase 1.B sub-jump A. The `Product` module is the operator-composable
counterpart to the back-of-house `IProduct` schema. One `EItemType.Product`
value carries five render variants dispatched on a per-instance `mode`
field — the same composer-based registry that hosts Hero / Manifesto /
Gallery / Timeline picks up Product without any `SectionContent.tsx`
edit.

## File layout

```
ui/client/modules/Product/
  Product.tsx              # dispatcher
  ProductFeatured.tsx      # one-product hero
  ProductGrid.tsx          # N×M cards
  ProductCarousel.tsx      # snap-scroll
  ProductComparison.tsx    # side-by-side table
  ProductRelated.tsx       # auto-populated grid
  ProductCard.tsx          # shared card primitive
  Product.types.ts         # IProductModule + IProductRenderable
  Product.scss             # base styles (token-driven)
  Product.test.tsx         # variant render coverage
  index.ts                 # barrel

ui/admin/modules/Product/
  ProductEditor.tsx        # mode picker + per-mode surfaces
  ProductPickerControl.tsx # predefined Select with product search
  ProductSourceControl.tsx # manual / category / tag / auto
```

## Mode dispatch

```ts
interface IProductModule {
    mode: 'featured' | 'grid' | 'carousel' | 'comparison' | 'related';
    products?: IProductSelection;
    showBuyCta?: boolean;
    // ... per-mode option bags
}
```

`Product.tsx` switches on `config.mode` and forwards `config + products`
to the variant component. Stored blobs without per-mode keys still
render because `ProductContent.data` merges `DEFAULT_PRODUCT_CONTENT`
at read time.

## Product selection

Source kinds: `manual` (operator-picked IDs), `category` (slug filter),
`tag` (tag filter), `auto` (rule: bestsellers / recent / on-sale /
related). All are predefined Selects in the editor — no free-text IDs.
Hydration to `IProductRenderable[]` is the page renderer's job (TBD in
sub-jump C; the renderer accepts a `products` prop for unit-test
injection today).

## Commerce flag coupling

`<BuyCta>` reads `commerce.checkoutEnabled` via the
`useCommerceFlags()` hook. When the master switch is off, the CTA
early-returns `null` — Product modules render catalogue-only without
any per-instance gesture from the operator. See
`docs/runbooks/commerce-enablement.md` for the flip path.

## Append-only registration

Adding the Product module touched exactly two places besides the new
files:

- `shared/enums/EItemType.ts` — append `Product = "PRODUCT"`
- `ui/client/modules/clientItemTypes.ts` + `ui/admin/modules/adminItemTypeEditors.ts` — register Display + Editor halves

`SectionContent.tsx` was not edited — the composer-based registry zips
the two halves at boot. Future modules follow the same shape.

## Deferred (sub-jump C+)

- `product.module.preview` MCP — server-side React render (current stub
  returns a placeholder HTML wrapper)
- SSR hydration of `IProductRenderable[]` for non-manual sources
- Per-theme Stitch design pass (today's per-theme `module-styles.scss`
  blocks are minimal defaults)
