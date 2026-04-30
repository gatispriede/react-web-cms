import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {ProductService} from '@services/features/Products/ProductService';
import type {IWarehouseAdapter} from './adapters/IWarehouseAdapter';
import type {
    IAdapterConfig,
    IInventoryDeadLetter,
    IInventoryRun,
    IInventoryRunError,
    InventoryStatus,
    SyncReport,
    SyncRunKind,
    SyncRunStatus,
    WarehouseProductRow,
} from '@interfaces/IInventory';
import {GenericFeedAdapter} from './adapters/GenericFeedAdapter';

/**
 * InventoryService — sole owner of the warehouse → Products pipeline.
 * Spec: docs/features/inventory-warehouse.md §3.
 *
 *   - Warehouse-wins / manual-wins matrix lives in
 *     `ProductService.upsertFromWarehouse` — we call it once per row.
 *     Per-field manual-override pinning is honoured there via the
 *     `manualOverrides[]` set on the existing doc.
 *   - The adapter is supplied by a closure (`getAdapter`) so tests can
 *     swap the adapter without re-constructing the service, and prod
 *     can reload after `saveAdapterConfig`.
 *   - Mutex: at most one `InventoryRuns` doc with `status: 'running'`
 *     and a heartbeat newer than 30 min. Stale runs are taken over and
 *     marked `failed` on the next start.
 *   - Dead-letter promotion: an externalId errors in 3 consecutive runs
 *     → row appears in `InventoryDeadLetters`.
 */

const RUNS = 'InventoryRuns';
const DEAD = 'InventoryDeadLetters';
const SETTINGS = 'SiteSettings';
const SETTINGS_KEY = 'inventoryAdapterConfig';
const HEARTBEAT_STALE_MS = 30 * 60 * 1000;
const MAX_ERRORS_PER_RUN = 1000;

export interface SyncOpts {
    dryRun?: boolean;
}

export interface IRevalidator {
    triggerRevalidate(scope: {scope: 'all'}): void;
}

type GetAdapter = () => IWarehouseAdapter;

interface RunCounters {
    pagesFetched: number;
    itemsCreated: number;
    itemsUpdated: number;
    itemsArchived: number;
    errors: IInventoryRunError[];
    seenIds: Set<string>;
    lastCursor?: string;
}

export class InventoryService {
    private runs: Collection;
    private dead: Collection;
    private settings: Collection;
    private indexesReady = false;

    constructor(
        private db: Db,
        private products: ProductService,
        private getAdapter: GetAdapter,
        /** Server-side ISR trigger — call site supplies a stub. */
        private revalidator?: IRevalidator,
    ) {
        this.runs = db.collection(RUNS);
        this.dead = db.collection(DEAD);
        this.settings = db.collection(SETTINGS);
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.runs.createIndex({status: 1, updatedAt: -1});
            await this.runs.createIndex({startedAt: -1});
            await this.runs.createIndex({id: 1}, {unique: true});
            await this.dead.createIndex({externalId: 1}, {unique: true});
            this.indexesReady = true;
        } catch (err) {
            console.error('InventoryService.ensureIndexes:', err);
        }
    }

    // -----------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------

    syncAll(opts: SyncOpts = {}): Promise<SyncReport> { return this.runSync('all', opts); }
    syncDelta(opts: SyncOpts = {}): Promise<SyncReport> { return this.runSync('delta', opts); }

    async getStatus(): Promise<InventoryStatus> {
        await this.ensureIndexes();
        const adapter = this.getAdapter();
        const [currentRun, lastSuccessfulRun, lastFailed] = await Promise.all([
            this.runs.findOne({status: 'running'}, {projection: {_id: 0}, sort: {startedAt: -1}}),
            this.runs.findOne({status: {$in: ['succeeded', 'partial']}}, {projection: {_id: 0}, sort: {startedAt: -1}}),
            this.runs.findOne({status: 'failed'}, {projection: {_id: 0}, sort: {startedAt: -1}}),
        ]);
        let healthOk = false;
        let healthMessage: string | undefined;
        let healthLatencyMs: number | undefined;
        try {
            const r = await adapter.healthCheck();
            healthOk = r.ok;
            healthMessage = r.message;
            healthLatencyMs = r.latencyMs;
        } catch (err) {
            healthMessage = String((err as Error).message || err);
        }
        const lastErr = (lastFailed as IInventoryRun | null)?.errors?.[0]?.reason;
        return {
            adapterId: adapter.id,
            healthOk,
            healthMessage,
            healthLatencyMs,
            currentRun: (currentRun as IInventoryRun | null) ?? null,
            lastSuccessfulRun: (lastSuccessfulRun as IInventoryRun | null) ?? null,
            lastError: lastErr,
        };
    }

    async saveAdapterConfig(config: IAdapterConfig, editedBy?: string): Promise<{ok: true}> {
        await this.ensureIndexes();
        if (!config || typeof config !== 'object' || !('kind' in config)) {
            throw new Error('saveAdapterConfig: invalid config');
        }
        const now = new Date().toISOString();
        await this.settings.updateOne(
            {key: SETTINGS_KEY},
            {$set: {key: SETTINGS_KEY, value: config, editedBy, editedAt: now}},
            {upsert: true},
        );
        return {ok: true};
    }

    async readAdapterConfig(): Promise<{config: IAdapterConfig | null; redacted: boolean}> {
        await this.ensureIndexes();
        const doc = await this.settings.findOne({key: SETTINGS_KEY}) as {value?: IAdapterConfig} | null;
        if (!doc?.value) return {config: null, redacted: false};
        const cfg = doc.value;
        if (cfg.kind === 'generic-feed' && cfg.credential) {
            return {config: {...cfg, credential: '***'}, redacted: true};
        }
        return {config: cfg, redacted: false};
    }

    /** Internal — used during adapter instantiation. NOT redacted. */
    async readAdapterConfigRaw(): Promise<IAdapterConfig | null> {
        await this.ensureIndexes();
        const doc = await this.settings.findOne({key: SETTINGS_KEY}) as {value?: IAdapterConfig} | null;
        return doc?.value ?? null;
    }

    async readDeadLetters({limit = 50}: {limit?: number} = {}): Promise<IInventoryDeadLetter[]> {
        await this.ensureIndexes();
        const cap = Math.max(1, Math.min(500, Math.floor(limit) || 50));
        const rows = await this.dead.find({}, {projection: {_id: 0}}).sort({lastSeenAt: -1}).limit(cap).toArray();
        return rows as unknown as IInventoryDeadLetter[];
    }

    async listRuns({limit = 20}: {limit?: number} = {}): Promise<IInventoryRun[]> {
        await this.ensureIndexes();
        const cap = Math.max(1, Math.min(200, Math.floor(limit) || 20));
        const rows = await this.runs.find({}, {projection: {_id: 0}}).sort({startedAt: -1}).limit(cap).toArray();
        return rows as unknown as IInventoryRun[];
    }

    // -----------------------------------------------------------------
    // Run loop
    // -----------------------------------------------------------------

    private async runSync(kind: SyncRunKind, opts: SyncOpts): Promise<SyncReport> {
        await this.ensureIndexes();
        const adapter: IWarehouseAdapter = this.getAdapter();

        // Health gate.
        try {
            const health = await adapter.healthCheck();
            if (!health.ok) {
                throw new Error(`adapter health check failed: ${health.message || 'unknown reason'}`);
            }
        } catch (err) {
            throw new Error(`inventory sync refused: ${String((err as Error).message || err)}`);
        }

        // Mutex (with stale-run takeover).
        const now = new Date();
        const cutoff = new Date(now.getTime() - HEARTBEAT_STALE_MS).toISOString();
        const live = await this.runs.findOne({status: 'running'}) as IInventoryRun | null;
        if (live) {
            if ((live.updatedAt || live.startedAt || '') > cutoff) {
                throw new Error('sync in progress');
            }
            await this.runs.updateOne(
                {id: live.id},
                {
                    $set: {status: 'failed', finishedAt: now.toISOString(), updatedAt: now.toISOString()},
                    $push: {errors: {externalId: '', reason: 'stale run; heartbeat lost'} as any},
                },
            );
        }

        const runId = guid();
        const startedAt = now.toISOString();

        // Carry validators (etag/last-modified) from the most recent
        // succeeded/partial run.
        const lastDone = await this.runs.findOne(
            {status: {$in: ['succeeded', 'partial']}},
            {projection: {_id: 0}, sort: {startedAt: -1}},
        ) as IInventoryRun | null;

        const initialDoc: IInventoryRun = {
            id: runId,
            kind,
            startedAt,
            status: 'running',
            pagesFetched: 0,
            itemsCreated: 0,
            itemsUpdated: 0,
            itemsArchived: 0,
            errors: [],
            updatedAt: startedAt,
            ...(lastDone?.etag ? {etag: lastDone.etag} : {}),
            ...(lastDone?.lastModified ? {lastModified: lastDone.lastModified} : {}),
        };
        await this.runs.insertOne({...initialDoc});

        const counters: RunCounters = {
            pagesFetched: 0, itemsCreated: 0, itemsUpdated: 0, itemsArchived: 0,
            errors: [], seenIds: new Set<string>(),
        };

        const validatorSink: {etag?: string; lastModified?: string} = {};
        // GenericFeedAdapter alone supports conditional GET hints; use a
        // duck-typed check via the adapter id so the static type of
        // `adapter` stays the bare interface (avoids union-narrowing
        // dropping the `fetchProductsSince?` member below).
        if (adapter.id === 'generic-feed' && typeof (adapter as unknown as GenericFeedAdapter).withFetchOpts === 'function') {
            (adapter as unknown as GenericFeedAdapter).withFetchOpts({
                ifNoneMatch: lastDone?.etag,
                ifModifiedSince: lastDone?.lastModified,
                sink: validatorSink,
            });
        }

        let cursor: string | undefined;
        let aborted = false;
        let abortReason: string | undefined;
        const sinceIso = lastDone?.startedAt;

        try {
            const HARD_CAP = 10_000;
            for (let page = 0; page < HARD_CAP; page++) {
                let result: {items: WarehouseProductRow[]; nextCursor: string | null};
                try {
                    if (kind === 'delta' && adapter.fetchProductsSince && sinceIso) {
                        result = await adapter.fetchProductsSince(sinceIso, cursor);
                    } else if (kind === 'delta' && sinceIso) {
                        const r = await adapter.fetchProducts(cursor);
                        result = {items: r.items.filter(i => (i.updatedAt || '') > sinceIso), nextCursor: r.nextCursor};
                    } else {
                        result = await adapter.fetchProducts(cursor);
                    }
                } catch (err) {
                    aborted = true;
                    abortReason = String((err as Error).message || err);
                    break;
                }
                counters.pagesFetched++;

                for (const row of result.items) {
                    await this.upsertOne(row, opts.dryRun === true, counters);
                }

                cursor = result.nextCursor ?? undefined;
                if (cursor) counters.lastCursor = cursor;
                const heartbeat = new Date().toISOString();
                await this.runs.updateOne(
                    {id: runId},
                    {$set: {
                        pagesFetched: counters.pagesFetched,
                        itemsCreated: counters.itemsCreated,
                        itemsUpdated: counters.itemsUpdated,
                        itemsArchived: counters.itemsArchived,
                        errors: counters.errors,
                        ...(counters.lastCursor ? {lastCursor: counters.lastCursor} : {}),
                        updatedAt: heartbeat,
                    }},
                );
                if (!cursor) break;
            }

            if (!aborted && kind === 'all' && !opts.dryRun) {
                counters.itemsArchived = await this.archiveMissing(counters.seenIds);
            }
        } catch (err) {
            aborted = true;
            abortReason = String((err as Error).message || err);
        }

        if (validatorSink.etag) initialDoc.etag = validatorSink.etag;
        if (validatorSink.lastModified) initialDoc.lastModified = validatorSink.lastModified;

        if (aborted && abortReason) {
            if (counters.errors.length < MAX_ERRORS_PER_RUN) {
                counters.errors.push({externalId: '', reason: abortReason});
            }
        }

        const finishedAt = new Date().toISOString();
        const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
        const status = decideStatus(counters, aborted);

        await this.runs.updateOne(
            {id: runId},
            {$set: {
                status,
                finishedAt,
                updatedAt: finishedAt,
                pagesFetched: counters.pagesFetched,
                itemsCreated: counters.itemsCreated,
                itemsUpdated: counters.itemsUpdated,
                itemsArchived: counters.itemsArchived,
                errors: counters.errors,
                ...(counters.lastCursor ? {lastCursor: counters.lastCursor} : {}),
                ...(initialDoc.etag ? {etag: initialDoc.etag} : {}),
                ...(initialDoc.lastModified ? {lastModified: initialDoc.lastModified} : {}),
            }},
        );

        try {
            await this.promoteDeadLetters(runId, counters.errors);
        } catch (err) {
            console.error('InventoryService.promoteDeadLetters:', err);
        }

        if ((status === 'succeeded' || status === 'partial') && !opts.dryRun) {
            try { this.revalidator?.triggerRevalidate({scope: 'all'}); }
            catch (err) { console.error('InventoryService.revalidator:', err); }
        }

        return {
            runId,
            kind,
            startedAt,
            finishedAt,
            durationMs,
            pagesFetched: counters.pagesFetched,
            itemsUpserted: counters.itemsCreated + counters.itemsUpdated,
            itemsCreated: counters.itemsCreated,
            itemsUpdated: counters.itemsUpdated,
            itemsArchived: counters.itemsArchived,
            errors: counters.errors.slice(),
            status,
        };
    }

    private async upsertOne(row: WarehouseProductRow, dryRun: boolean, counters: RunCounters): Promise<void> {
        const externalId = (row.externalId || '').trim();
        if (!externalId) {
            if (counters.errors.length < MAX_ERRORS_PER_RUN) {
                counters.errors.push({externalId: '', reason: 'missing externalId'});
            }
            return;
        }
        try {
            if (dryRun) {
                // DECISION: dry-run only counts; no DB peek to differentiate
                // create vs update (would double the read cost for limited
                // signal). The summary is "would-write N rows".
                counters.itemsUpdated++;
                counters.seenIds.add(externalId);
                return;
            }
            const res = await this.products.upsertFromWarehouse({
                externalId,
                sku: row.sku || externalId,
                title: row.title || '',
                price: typeof row.priceCents === 'number' && Number.isFinite(row.priceCents) ? row.priceCents : 0,
                currency: row.currency || '',
                stock: typeof row.stock === 'number' && Number.isFinite(row.stock) ? row.stock : 0,
                images: row.images,
                attributes: coerceStringMap(row.attributes),
            });
            if (res.created) counters.itemsCreated++;
            else counters.itemsUpdated++;
            counters.seenIds.add(externalId);
        } catch (err) {
            if (counters.errors.length < MAX_ERRORS_PER_RUN) {
                counters.errors.push({externalId, reason: String((err as Error).message || err)});
            }
        }
    }

    private async archiveMissing(seen: Set<string>): Promise<number> {
        const productsCol: Collection = (this.products as unknown as {products: Collection}).products
            ?? this.db.collection('Products');
        const cursor = productsCol.find({source: 'warehouse'}, {projection: {id: 1, externalId: 1, draft: 1}});
        let archived = 0;
        const now = new Date().toISOString();
        for await (const doc of cursor as any) {
            const ext = (doc as {externalId?: string}).externalId;
            const draft = (doc as {draft?: boolean}).draft;
            if (ext && !seen.has(ext) && draft !== true) {
                await productsCol.updateOne(
                    {id: (doc as {id: string}).id},
                    {$set: {draft: true, updatedAt: now, editedBy: 'warehouse-adapter'}},
                );
                archived++;
            }
        }
        return archived;
    }

    private async promoteDeadLetters(runId: string, errors: IInventoryRunError[]): Promise<void> {
        if (errors.length === 0) return;
        const recent = await this.runs.find({}, {projection: {_id: 0, id: 1, errors: 1, startedAt: 1}})
            .sort({startedAt: -1}).limit(3).toArray();
        if (recent.length < 3) return;
        const sets = recent.map(r => new Set((((r as any).errors as IInventoryRunError[]) || []).map(e => e.externalId).filter(Boolean)));
        const triple = new Set<string>();
        for (const id of sets[0]) {
            if (id && sets[1].has(id) && sets[2].has(id)) triple.add(id);
        }
        const now = new Date().toISOString();
        for (const externalId of triple) {
            const reason = errors.find(e => e.externalId === externalId)?.reason || 'unknown';
            await this.dead.updateOne(
                {externalId},
                {
                    $set: {externalId, reason, lastSeenAt: now},
                    $setOnInsert: {id: guid(), firstSeenAt: now},
                    $addToSet: {runIds: runId},
                },
                {upsert: true},
            );
        }
    }
}

function decideStatus(c: RunCounters, didAbort: boolean): SyncRunStatus {
    const items = c.itemsCreated + c.itemsUpdated;
    if (didAbort) return 'partial';
    if (c.errors.length > 0 && items > 0) return 'partial';
    if (c.errors.length > 0 && items === 0) return 'failed';
    return 'succeeded';
}

function coerceStringMap(input: Record<string, unknown> | undefined): Record<string, string> | undefined {
    if (!input) return undefined;
    const out: Record<string, string> = {};
    for (const k of Object.keys(input)) {
        const v = input[k];
        if (v === null || v === undefined) continue;
        if (typeof v === 'string') out[k] = v;
        else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
    }
    return out;
}
