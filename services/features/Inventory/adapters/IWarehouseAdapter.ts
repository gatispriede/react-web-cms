/**
 * Warehouse adapter contract — the only seam between `InventoryService`
 * and the upstream system of record. See docs/features/inventory-warehouse.md §1.
 *
 * Adapters MUST cap a single page at a sane size (suggest 200) to keep
 * memory bounded; cursor is opaque to the orchestrator.
 */
import type {FetchPage, HealthResult} from '@interfaces/IInventory';

export type {FetchPage, HealthResult, WarehouseProductRow} from '@interfaces/IInventory';

export interface IWarehouseAdapter {
    /** Self-reported id — `'mock' | 'generic-feed' | …`. */
    readonly id: string;
    /** Page through *all* products. Cursor is opaque to the orchestrator. */
    fetchProducts(cursor?: string): Promise<FetchPage>;
    /** Optional delta. If absent, `syncDelta` falls back to `fetchProducts`
     *  filtered by `updatedAt > lastSuccessfulRunAt`. */
    fetchProductsSince?(since: string, cursor?: string): Promise<FetchPage>;
    healthCheck(): Promise<HealthResult>;
    /**
     * Phase 1.C — products-as-composable-page sub-jump B.
     *
     * Declares the attribute-key hierarchy this adapter uses to bucket its
     * products into a page tree. Order matters: root → leaf. The
     * `WarehousePageSyncWorker` reads `product.attributes[key]` for each key
     * in turn and creates one `IPage` per distinct value at each level.
     *
     * Examples:
     *   - cars adapter:        `['category', 'subcategory', 'make', 'model']`
     *   - general retail:      `['category', 'subcategory', 'brand']`
     *   - return `[]`          to opt out of auto-page-tree generation (the
     *                          worker still creates leaf pages from
     *                          individual products via `IPage.productId`).
     *
     * Optional for backwards-compat — adapters that haven't been updated
     * yet are treated as `[]` (leaf-only) and skip category-tree generation.
     */
    getCategoryHierarchy?(): readonly string[];
}
