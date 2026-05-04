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

export interface IProduct {
    id: string;
    sku: string;
    title: string;
    slug: string;
    description: string;
    price: number;
    currency: string;
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
}

export interface InProduct {
    id?: string;
    sku: string;
    title: string;
    slug?: string;
    description?: string;
    price: number;
    currency: string;
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
