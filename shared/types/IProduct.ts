/**
 * Product domain type. Mirrors the IPost / InPost split — `IProduct` is the
 * stored shape (with version + audit fields), `InProduct` is the input shape
 * the admin UI (or warehouse adapter) sends.
 *
 * Pricing: a single `price` (integer minor units) + ISO-4217 `currency`. No
 * multi-currency in v1 — see docs/features/products.md §10.1.
 *
 * Stock semantics: when `variants[]` is non-empty, the variants own stock and
 * the parent `stock` is ignored at runtime (still stored for backward compat).
 *
 * `source` discriminates manual edits from warehouse-sync writes; warehouse
 * fields (price, stock, sku, images, attributes, variants) are overwritten on
 * each sync — see `ProductService.upsertFromWarehouse`. `manualOverrides` is
 * reserved for the inventory module's per-field stickiness toggle (e.g. the
 * admin can pin `title` so warehouse syncs stop overwriting it).
 */
export interface IProductVariant {
    id: string;
    sku: string;
    title: string;
    price?: number;
    stock: number;
    attributes: Record<string, string>;
}

/**
 * Multi-currency price map. Sparse — operators set native prices only for
 * the markets they care about; `EcbFxService.convert` fills in the rest at
 * display time. Backwards-compat: legacy single-currency products are read
 * as `prices: { [currency]: price }` by `ProductService.normalize`.
 */
export type ProductPrices = Record<string, number>;

export interface IProduct {
    id: string;
    sku: string;
    title: string;
    slug: string;
    description: string;
    price: number;
    currency: string;
    /** Multi-currency map, minor units keyed by ISO-4217. See ProductPrices. */
    prices?: ProductPrices;
    stock: number;
    images: string[];
    categories: string[];
    attributes: Record<string, string>;
    variants: IProductVariant[];
    source: 'manual' | 'warehouse';
    externalId?: string;
    /** Field names the admin has pinned against warehouse-sync overwrites. */
    manualOverrides?: string[];
    draft: boolean;
    publishedAt?: string;
    createdAt: string;
    updatedAt: string;
    /** Optimistic-concurrency counter — see `services/infra/conflict.ts`. */
    version?: number;
    editedBy?: string;
    editedAt?: string;
    /**
     * Reference to an `IProductTemplate.id`. When omitted/undefined the
     * leaf product page renders with `built-in:standard` fallback.
     *
     * Operator-edited per-product `IPage.sections` for the leaf page
     * override the template (template is the default; per-product is the
     * override). Phase 1.F (product-display-templates).
     */
    templateId?: string;
    /**
     * Optional per-product section diff applied on top of the resolved
     * template's sections. Reserved for future use — today operators
     * override via direct `IPage.sections` edits on the leaf product
     * page. Phase 1.F (product-display-templates).
     */
    templateOverrides?: Partial<unknown>[];
    /**
     * Optional pointer to a parent bundle product. When set, the
     * `SubProductsGrid` module renders this product as a sibling under
     * the same parent. Used by the `built-in:bundle` template.
     * Phase 1.F follow-up (sibling-products fetch).
     */
    bundleParentId?: string;
}

export interface InProduct {
    id?: string;
    sku: string;
    title: string;
    slug?: string;
    description?: string;
    price: number;
    currency: string;
    prices?: ProductPrices;
    stock?: number;
    images?: string[];
    categories?: string[];
    attributes?: Record<string, string>;
    variants?: IProductVariant[];
    source?: 'manual' | 'warehouse';
    externalId?: string;
    manualOverrides?: string[];
    draft?: boolean;
    publishedAt?: string;
    /** Phase 1.F — template-picker write-side passthrough. */
    templateId?: string;
}

/**
 * Input shape for the warehouse adapter. The adapter passes its `externalId`
 * unconditionally (used as the upsert key), and the doc's `source` is forced
 * to `'warehouse'` server-side regardless of what the adapter sends.
 */
export interface WarehouseProductInput {
    externalId: string;
    sku: string;
    title: string;
    price: number;
    currency: string;
    stock: number;
    images?: string[];
    attributes?: Record<string, string>;
    variants?: IProductVariant[];
}
