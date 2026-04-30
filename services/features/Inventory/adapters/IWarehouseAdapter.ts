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
}
