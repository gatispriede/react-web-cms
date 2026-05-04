/**
 * Inventory / Warehouse adapter shared types. Mirrors the spec at
 * docs/features/inventory-warehouse.md §1.
 *
 * `WarehouseProductRow` is the **adapter-facing** product shape: every
 * adapter normalises whatever the upstream system speaks (Postgres rows,
 * REST JSON, CSV columns, …) into this shape before handing pages back
 * to `InventoryService`. Cents are intentional — adapters convert to
 * minor units so `ProductService.upsertFromWarehouse` (which speaks
 * `price` minor-units already) doesn't need a per-call conversion.
 */
export interface WarehouseProductRow {
    /** Stable id in the warehouse — used as the upsert key on the Products doc. */
    externalId: string;
    sku?: string;
    title: string;
    description?: string;
    /** Integer minor units. e.g. EUR 9.99 → 999. */
    priceCents: number;
    /** ISO-4217 code, e.g. 'EUR'. */
    currency: string;
    stock: number;
    /** Remote URLs; v1 stores verbatim (image rehosting deferred). */
    images?: string[];
    attributes?: Record<string, unknown>;
    /** ISO timestamp from the source system. */
    updatedAt: string;
}

export interface FetchPage {
    items: WarehouseProductRow[];
    /** `null` = end of stream. */
    nextCursor: string | null;
}

export interface HealthResult {
    ok: boolean;
    latencyMs: number;
    message?: string;
    /** Self-reported adapter id, e.g. 'mock', 'generic-feed'. */
    adapter: string;
}

/**
 * Discriminated config union. New adapter kinds extend the union; the
 * factory in `services/features/Inventory/adapters/index.ts` switches on
 * `kind` and constructs the adapter.
 */
export type IAdapterConfig =
    | {kind: 'mock'}
    | ({kind: 'generic-feed'} & GenericFeedConfig);

export interface GenericFeedConfig {
    url: string;
    authMode?: 'none' | 'bearer' | 'apiKey' | 'basic';
    /** Stored as a secret. For `basic`: `'user:pass'` colon form. */
    credential?: string;
    /** For `apiKey` mode — header name (default `X-Api-Key`). */
    apiKeyHeader?: string;
    /** JSONPath-ish (top-level key, dot-separated) into the response. */
    itemsPath?: string;
    pagination?:
        | {kind: 'none'}
        | {kind: 'link-header'}
        | {kind: 'cursor'; cursorParam: string; cursorPath: string}
        | {kind: 'page'; pageParam: string; pageStart?: number}
        | {kind: 'offset'; offsetParam: string; limitParam: string; limit: number};
    /** Per-`WarehouseProductRow` field → JSONPath / CSV column name. */
    fieldMap: Partial<Record<keyof WarehouseProductRow, string>>;
    /** Cron expression. Operator wires this into scheduled-tasks externally. */
    pollInterval?: string;
}

export type SyncRunStatus = 'running' | 'succeeded' | 'failed' | 'partial';
export type SyncRunKind = 'all' | 'delta';

export interface IInventoryRunError {
    externalId: string;
    reason: string;
}

export interface IInventoryRun {
    id: string;
    kind: SyncRunKind;
    startedAt: string;
    finishedAt?: string;
    status: SyncRunStatus;
    /** Opaque cursor of the **last successfully written** page. Used for resume. */
    lastCursor?: string;
    pagesFetched: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsArchived: number;
    errors: IInventoryRunError[];
    /** Heartbeat — every batch bumps this so a crashed run is detectable. */
    updatedAt: string;
    /** Cached HTTP validators for conditional GET on next run. */
    etag?: string;
    lastModified?: string;
}

export interface IInventoryDeadLetter {
    id: string;
    externalId: string;
    reason: string;
    firstSeenAt: string;
    lastSeenAt: string;
    runIds: string[];
}

export interface SyncReport {
    runId: string;
    kind: SyncRunKind;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    pagesFetched: number;
    itemsUpserted: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsArchived: number;
    errors: IInventoryRunError[];
    status: SyncRunStatus;
}

export interface InventoryStatus {
    adapterId: string;
    healthOk: boolean;
    healthMessage?: string;
    healthLatencyMs?: number;
    currentRun: IInventoryRun | null;
    lastSuccessfulRun: IInventoryRun | null;
    lastError?: string;
}
