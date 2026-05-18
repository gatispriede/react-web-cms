/**
 * Phase 1.C — ProductDetailHero module types.
 *
 * Auto-injected by `ProductDetailTemplate` onto warehouse-derived leaf
 * product pages. Renders image gallery + title + price + Buy CTA + VAT
 * badge. Reuses W8g `<PriceDisplay>` + W7b `<VatBadge>` (resolved at
 * render time).
 */
export interface IProductDetailHero {
    /** Bound product id — the renderer hydrates from `ProductContext`. */
    productId: string;
    /** Adapter id (debugging breadcrumb). */
    adapterId?: string;
    /** When false the Buy CTA renders disabled with a "reservation only"
     *  label — used when `commerce.checkoutEnabled` is off OR the product
     *  is `source: 'reservation-only'`. Default true. */
    showBuyCta?: boolean;
    /** When false, the VAT badge is hidden (e.g. B2B-only catalogues).
     *  Default true. */
    showVatBadge?: boolean;
}

export enum EProductDetailHeroStyle {
    Default = 'default',
    Compact = 'compact',
    Split = 'split',
    Stacked = 'stacked',
    Magazine = 'magazine',
}
