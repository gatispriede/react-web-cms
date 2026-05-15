/**
 * Product module — shared types for the 5-variant content module.
 *
 * Mode dispatch lives INSIDE the module: one `EItemType.Product` value
 * carries five render variants (featured / grid / carousel / comparison
 * / related). See `docs/roadmap/storefront/product-module-and-checkout-customization.md`.
 *
 * Product sourcing is enumerated, never free-text. Operators pick by
 * product ID via the admin picker (search by slug/name); category /
 * tag / auto modes hydrate the list at render time from
 * `ProductService.list()`.
 */

export type ProductModuleMode = 'featured' | 'grid' | 'carousel' | 'comparison' | 'related';
export type ProductSource = 'manual' | 'category' | 'tag' | 'auto';
export type ProductAutoRule = 'bestsellers' | 'recent' | 'on-sale' | 'related';

export interface IProductSelection {
    source: ProductSource;
    /** Manual: explicit product IDs in display order. */
    ids?: string[];
    /** Category source: slug filter. */
    category?: string;
    /** Tag source: tag filter. */
    tag?: string;
    /** Auto source: rule that hydrates the list at render time. */
    autoRule?: ProductAutoRule;
    /** Maximum hydrated rows. Per-mode default applied at render. */
    limit?: number;
}

export interface IFeaturedOptions {
    imagePosition: 'left' | 'right' | 'top' | 'background';
    ctaText?: string;
    ctaStyle: 'primary' | 'secondary' | 'ghost';
}

export interface IGridOptions {
    columns: 2 | 3 | 4 | 5 | 6;
    rows?: number;
    density: 'compact' | 'standard' | 'spacious';
}

export interface ICarouselOptions {
    slidesPerView: 2 | 3 | 4;
    autoplay?: boolean;
    showDots: boolean;
    showArrows: boolean;
}

export interface IComparisonOptions {
    /** Either `'all-attributes'` or an explicit list of attribute keys
     *  (preserved order = column order in the rendered table). */
    rows: 'all-attributes' | string[];
    highlightDifferences: boolean;
}

export interface IRelatedOptions {
    rule: 'same-category' | 'same-tags' | 'frequently-bought-together';
}

export interface IProductModule {
    mode: ProductModuleMode;
    products?: IProductSelection;
    /** Master CTA toggle — also gated by `commerce.checkoutEnabled`. */
    showBuyCta?: boolean;
    showPrice?: boolean;
    showRating?: boolean;
    showStockBadge?: boolean;
    featured?: IFeaturedOptions;
    grid?: IGridOptions;
    carousel?: ICarouselOptions;
    comparison?: IComparisonOptions;
    related?: IRelatedOptions;
}

export enum EProductStyle {
    Default = 'default',
    Bordered = 'bordered',
    Minimal = 'minimal',
}

export const DEFAULT_PRODUCT_CONTENT: IProductModule = {
    mode: 'grid',
    products: {source: 'manual', ids: [], limit: 6},
    showBuyCta: true,
    showPrice: true,
    showRating: false,
    showStockBadge: false,
    grid: {columns: 3, density: 'standard'},
    featured: {imagePosition: 'left', ctaStyle: 'primary'},
    carousel: {slidesPerView: 3, showDots: true, showArrows: true},
    comparison: {rows: 'all-attributes', highlightDifferences: true},
    related: {rule: 'same-category'},
};

/** Lightweight product shape consumed by the renderer. Mirrors a subset
 *  of `IProduct` so the module can be exercised against fixture data
 *  without dragging the full product domain into tests. */
export interface IProductRenderable {
    id: string;
    slug: string;
    title: string;
    description?: string;
    price?: number;
    currency?: string;
    /**
     * Multi-currency price map (W8g) — minor units keyed by ISO-4217. When
     * present the renderer picks the visitor's display currency from this
     * map and falls back to `price`/`currency` (with a `≈` FX hint) when
     * there's no native entry. See `@utils/displayCurrency`.
     */
    prices?: Record<string, number>;
    /** FX-fallback pivot currency. Defaults to `currency` when omitted. */
    baseCurrency?: string;
    image?: string;
    attributes?: Record<string, string>;
    stockStatus?: 'in-stock' | 'out-of-stock' | 'preorder';
    rating?: {score: number; count: number};
}
