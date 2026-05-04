import type {IWarehouseAdapter} from './IWarehouseAdapter';
import type {FetchPage, HealthResult, WarehouseProductRow} from '@interfaces/IInventory';

export interface MockAdapterOpts {
    rows?: WarehouseProductRow[];
    pageSize?: number;
    failHealthCheck?: boolean;
    /** Throw on the Nth `fetchProducts` invocation (1-indexed). 0/undef = never. */
    throwAfter?: number;
    /** Optional override id for distinguishing test fixtures. */
    id?: string;
}

/**
 * In-memory deterministic adapter for tests + local dev. Cursors look like
 * `page-1`, `page-2`, … so test assertions can pin them. The `throwAfter`
 * knob lets a test trigger a mid-stream error — `InventoryService` should
 * mark the run `partial` and persist `lastCursor`.
 */
export class MockAdapter implements IWarehouseAdapter {
    public readonly id: string;
    private rows: WarehouseProductRow[];
    private pageSize: number;
    private failHealthCheck: boolean;
    private throwAfter: number;
    private callCount = 0;

    constructor(opts: MockAdapterOpts = {}) {
        this.id = opts.id ?? 'mock';
        this.rows = opts.rows ?? [];
        this.pageSize = opts.pageSize ?? 50;
        this.failHealthCheck = !!opts.failHealthCheck;
        this.throwAfter = opts.throwAfter ?? 0;
    }

    /** Test helper — swap the fixture without rebuilding the service. */
    setRows(rows: WarehouseProductRow[]): void {
        this.rows = rows;
    }

    setFailHealthCheck(fail: boolean): void {
        this.failHealthCheck = fail;
    }

    setThrowAfter(n: number): void {
        this.throwAfter = n;
        this.callCount = 0;
    }

    async healthCheck(): Promise<HealthResult> {
        if (this.failHealthCheck) {
            return {ok: false, latencyMs: 0, adapter: this.id, message: 'mock health check failure'};
        }
        return {ok: true, latencyMs: 0, adapter: this.id};
    }

    async fetchProducts(cursor?: string): Promise<FetchPage> {
        this.callCount++;
        if (this.throwAfter > 0 && this.callCount > this.throwAfter) {
            throw new Error('mock adapter: simulated mid-stream failure');
        }
        const page = cursor ? Number((cursor.match(/^page-(\d+)$/) || [])[1] || '1') : 1;
        if (!Number.isFinite(page) || page < 1) {
            return {items: [], nextCursor: null};
        }
        const start = (page - 1) * this.pageSize;
        const slice = this.rows.slice(start, start + this.pageSize);
        const hasMore = start + slice.length < this.rows.length;
        return {
            items: slice,
            nextCursor: hasMore ? `page-${page + 1}` : null,
        };
    }

    async fetchProductsSince(since: string, cursor?: string): Promise<FetchPage> {
        const filtered = this.rows.filter(r => r.updatedAt > since);
        const original = this.rows;
        this.rows = filtered;
        try {
            return await this.fetchProducts(cursor);
        } finally {
            this.rows = original;
        }
    }
}
