/**
 * Phase 1.C — `WarehousePageSyncWorker` unit tests.
 *
 * Covers: bucketing, idempotency, operator-override preservation,
 * dry-run preview, soft-delete-on-disappear.
 */
import {describe, it, expect, vi} from 'vitest';
import type {WarehouseProductRow, FetchPage} from '@interfaces/IInventory';
import type {IWarehouseAdapter} from '@services/features/Inventory/adapters/IWarehouseAdapter';
import type {IPage} from '@interfaces/IPage';
import type {ISection} from '@interfaces/ISection';
import {
    WarehousePageSyncWorker,
    runSyncOnce,
    bucketByHierarchy,
    type IWarehousePageSyncPort,
} from './WarehousePageSyncWorker';

const makeRow = (overrides: Partial<WarehouseProductRow>): WarehouseProductRow => ({
    externalId: overrides.externalId ?? 'p-1',
    title: overrides.title ?? 'Item',
    priceCents: 1000,
    currency: 'EUR',
    stock: 1,
    updatedAt: '2026-05-01T00:00:00.000Z',
    attributes: overrides.attributes ?? {},
    ...overrides,
});

class FakeAdapter implements IWarehouseAdapter {
    readonly id = 'fake';
    constructor(public rows: WarehouseProductRow[]) {}
    async fetchProducts(): Promise<FetchPage> { return {items: this.rows, nextCursor: null}; }
    async healthCheck() { return {ok: true, latencyMs: 0, adapter: this.id}; }
    getCategoryHierarchy() { return ['category', 'subcategory'] as const; }
}

class FakePort implements IWarehousePageSyncPort {
    pages: IPage[] = [];
    sectionsById = new Map<string, ISection[]>();
    /** Set to make every existing page look operator-edited. */
    forceOperatorEdited = false;

    async listDerivedPages(): Promise<IPage[]> { return this.pages; }
    async createDerivedPage(args: {page: Partial<IPage>; sections: ISection[]}) {
        const p: IPage = {
            id: typeof args.page.slug === 'string' ? args.page.slug : 'x',
            page: args.page.page ?? '',
            seo: args.page.seo ?? {},
            sections: [],
            ...args.page,
        };
        this.pages.push(p);
        this.sectionsById.set(p.id!, args.sections);
        return p;
    }
    async updateDerivedPage() { /* no-op */ }
    async softDeletePage(id: string) {
        this.pages = this.pages.filter(p => p.id !== id);
    }
    isOperatorEdited(_p: IPage, _f: string): boolean { return this.forceOperatorEdited; }
    async getSectionsForPage(p: IPage): Promise<ISection[]> {
        return this.sectionsById.get(p.id ?? '') ?? [];
    }
    async createRedirect() {/* no-op */}
}

describe('bucketByHierarchy', () => {
    it('groups products into N-deep paths', () => {
        const rows = [
            makeRow({externalId: 'a', attributes: {category: 'Cars', subcategory: 'Used'}}),
            makeRow({externalId: 'b', attributes: {category: 'Cars', subcategory: 'New'}}),
            makeRow({externalId: 'c', attributes: {category: 'Electronics'}}),
        ];
        const buckets = bucketByHierarchy(rows, ['category', 'subcategory']);
        expect(buckets.get('cars')).toHaveLength(2);
        expect(buckets.get('cars/used')).toHaveLength(1);
        expect(buckets.get('cars/new')).toHaveLength(1);
        expect(buckets.get('electronics')).toHaveLength(1);
    });

    it('returns empty map when hierarchy is empty', () => {
        const out = bucketByHierarchy([makeRow({})], []);
        expect(out.size).toBe(0);
    });
});

describe('runSyncOnce', () => {
    it('creates a category branch + leaf page on first run', async () => {
        const adapter = new FakeAdapter([
            makeRow({externalId: 'p-1', title: 'BMW 330i', attributes: {category: 'Cars', subcategory: 'Used'}}),
        ]);
        const port = new FakePort();
        const result = await runSyncOnce({adapter, port});
        expect(result.created).toBeGreaterThan(0);
        expect(result.errors).toBe(0);
        // Branches + leaf page rows landed.
        expect(port.pages.some(p => p.slug === 'cars')).toBe(true);
        expect(port.pages.some(p => p.slug === 'used')).toBe(true);
        expect(port.pages.some(p => p.productId === 'p-1')).toBe(true);
    });

    it('dry-run reports outcomes but does not write', async () => {
        const adapter = new FakeAdapter([makeRow({attributes: {category: 'Cars'}})]);
        const port = new FakePort();
        const result = await runSyncOnce({adapter, port, dryRun: true});
        expect(result.dryRun).toBe(true);
        expect(port.pages).toHaveLength(0);
        expect(result.perPage?.length).toBeGreaterThan(0);
    });

    it('skips operator-edited pages and reports them', async () => {
        const adapter = new FakeAdapter([makeRow({attributes: {category: 'Cars'}})]);
        const port = new FakePort();
        // Seed an existing edited page.
        port.pages.push({
            id: 'cars',
            page: 'Cars',
            slug: 'cars',
            source: 'product',
            seo: {},
            sections: [],
        });
        port.forceOperatorEdited = true;
        const result = await runSyncOnce({adapter, port});
        expect(result.skippedOperatorEdited).toBeGreaterThan(0);
        const outcome = result.perPage?.find(p => p.slug === 'cars');
        expect(outcome?.outcome).toBe('skipped-operator-edited');
    });

    it('soft-deletes leaf pages whose product disappeared', async () => {
        const adapter = new FakeAdapter([]); // no live products
        const port = new FakePort();
        port.pages.push({
            id: 'p-1',
            page: 'Old item',
            slug: 'old-item',
            productId: 'p-1',
            source: 'product',
            seo: {},
            sections: [],
        });
        const result = await runSyncOnce({adapter, port});
        expect(result.softDeleted).toBe(1);
        expect(port.pages).toHaveLength(0);
    });

    it('is idempotent — re-running the same input produces no new writes', async () => {
        const adapter = new FakeAdapter([
            makeRow({externalId: 'p-1', title: 'Item', attributes: {category: 'Cars'}}),
        ]);
        const port = new FakePort();
        await runSyncOnce({adapter, port});
        const beforeCount = port.pages.length;
        const second = await runSyncOnce({adapter, port});
        expect(port.pages.length).toBe(beforeCount);
        // The 2nd run reports updates (touch lastSyncedAt) not creates.
        expect(second.created).toBe(0);
    });
});

describe('runSyncOnce — auto-301 on slug rename (Phase 1.C-c)', () => {
    it('fires createRedirect when a productId-bound page changes slug upstream', async () => {
        // First tick: title is "BMW 330i" → slug "bmw-330i".
        const adapter = new FakeAdapter([
            makeRow({externalId: 'p-1', title: 'BMW 330i', attributes: {category: 'Cars'}}),
        ]);
        const port = new FakePort();
        const redirectsSeen: Array<{from: string; to: string}> = [];
        port.createRedirect = async (args) => { redirectsSeen.push({from: args.from, to: args.to}); };
        await runSyncOnce({adapter, port});
        // Second tick: same product, new title → new slug.
        adapter.rows = [
            makeRow({externalId: 'p-1', title: 'BMW 330i Touring', attributes: {category: 'Cars'}}),
        ];
        await runSyncOnce({adapter, port});
        expect(redirectsSeen).toEqual([
            {from: '/bmw-330i', to: '/bmw-330i-touring'},
        ]);
    });

    it('swallows "already exists" errors from the port (idempotent contract)', async () => {
        // Port-side idempotency: createRedirect throws the canonical
        // "redirect already exists for …" the way RedirectsService.create
        // does. The worker must NOT count this as an error or crash.
        const adapter = new FakeAdapter([
            makeRow({externalId: 'p-1', title: 'Foo', attributes: {category: 'Cars'}}),
        ]);
        const port = new FakePort();
        let calls = 0;
        port.createRedirect = async (args) => {
            calls += 1;
            throw new Error(`redirect already exists for ${args.from}`);
        };
        await runSyncOnce({adapter, port});
        adapter.rows = [makeRow({externalId: 'p-1', title: 'Bar', attributes: {category: 'Cars'}})];
        const result = await runSyncOnce({adapter, port});
        expect(calls).toBe(1);
        expect(result.errors).toBe(0);
    });

    it('audit-log hook fires alongside createRedirect via the port', async () => {
        const adapter = new FakeAdapter([
            makeRow({externalId: 'p-1', title: 'Old', attributes: {category: 'Cars'}}),
        ]);
        const port = new FakePort();
        const audit: Array<{tag?: string; from?: string}> = [];
        // Simulate the loader-side port: createRedirect implementation also
        // writes an audit row. The worker only invokes createRedirect; the
        // audit write is the port impl's responsibility — this asserts the
        // contract surfaces audit data when the port chooses to.
        port.createRedirect = async (args) => {
            audit.push({tag: 'warehouse-derived-rename', from: args.from});
        };
        await runSyncOnce({adapter, port});
        adapter.rows = [makeRow({externalId: 'p-1', title: 'New', attributes: {category: 'Cars'}})];
        await runSyncOnce({adapter, port});
        expect(audit).toEqual([{tag: 'warehouse-derived-rename', from: '/old'}]);
    });

    it('does not fire createRedirect in dry-run mode', async () => {
        const adapter = new FakeAdapter([
            makeRow({externalId: 'p-1', title: 'A', attributes: {category: 'Cars'}}),
        ]);
        const port = new FakePort();
        const calls: number[] = [];
        port.createRedirect = async () => { calls.push(1); };
        await runSyncOnce({adapter, port});
        adapter.rows = [makeRow({externalId: 'p-1', title: 'B', attributes: {category: 'Cars'}})];
        await runSyncOnce({adapter, port, dryRun: true});
        expect(calls.length).toBe(0);
    });
});

describe('WarehousePageSyncWorker.runNow', () => {
    it('runs all adapters when no adapterId filter is set', async () => {
        const a = new FakeAdapter([makeRow({attributes: {category: 'Cars'}})]);
        const port = new FakePort();
        const w = new WarehousePageSyncWorker(() => [a], port, {intervalMs: 999999});
        const results = await w.runNow();
        expect(results).toHaveLength(1);
        expect(results[0].adapterId).toBe('fake');
    });

    it('respects the autoSync flag in tick gating (no flag → no work)', async () => {
        const a = new FakeAdapter([makeRow({})]);
        const port = new FakePort();
        const w = new WarehousePageSyncWorker(() => [a], port, {
            intervalMs: 999999,
            readAutoSyncFlag: async () => false,
        });
        // private tick is invoked via start() — verify by checking
        // lastResult stays null.
        w.start();
        await new Promise(r => setTimeout(r, 10));
        w.stop();
        expect(w.getLastResult()).toBeNull();
    });
});
