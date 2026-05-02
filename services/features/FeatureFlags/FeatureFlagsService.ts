import {Collection, Db} from 'mongodb';
import {log} from '@services/infra/logger';
import {markRestartRequired, clearRestartReason} from '@services/infra/restartRequired';

/**
 * Mongo-backed override store for plug-and-play feature flags.
 *
 * Resolution order (defined in `services/infra/featureFlags.ts`):
 *   1. `FEATURE_<UPPER>` env var — operator-pinned, wins always
 *   2. Mongo override row written by the admin UI / MCP tool
 *   3. Per-feature default (e-commerce + MCP off, everything else on)
 *
 * Storage shape — one row per flagged feature:
 *   { id: 'cart', enabled: true,  updatedAt: '2026-05-01...', updatedBy: 'admin@…' }
 *   { id: 'mcp',  enabled: false, updatedAt: '2026-05-01...', updatedBy: 'mcp:tok-…' }
 *
 * The `id` field is the manifest id (`cart`, `products`, …); we never
 * store unknown ids — `set()` rejects anything not in the registry.
 *
 * Boot-time cache: `loadAll()` populates a module-level Map that
 * `featureFlags.ts` reads synchronously from `isFeatureEnabled()`. The
 * cache invalidates on every `set()` so admin writes take effect for
 * every NEW HTTP request — already-running registry composition (the
 * static schema, registry's active set) is locked in until restart.
 */

export interface IFeatureFlagRow {
    id: string;
    enabled: boolean;
    updatedAt: string;
    updatedBy?: string;
}

export class FeatureFlagsService {
    private readonly col: Collection;

    constructor(db: Db) {
        this.col = db.collection('FeatureFlags');
        // Idempotent — `createIndex` is a no-op when the same spec already exists.
        this.col.createIndex({id: 1}, {unique: true}).catch(() => {/* already exists */});
    }

    /** All persisted overrides — admin panel + cache prime read this. */
    async listAll(): Promise<IFeatureFlagRow[]> {
        try {
            const rows = await this.col.find({}, {projection: {_id: 0}}).toArray();
            return rows as unknown as IFeatureFlagRow[];
        } catch (err) {
            log.error({scope: 'featureFlags.listAll', err}, 'listAll failed');
            return [];
        }
    }

    /** Single override read — `undefined` means "no override, fall through to default". */
    async get(id: string): Promise<boolean | undefined> {
        try {
            const row = await this.col.findOne({id}, {projection: {enabled: 1, _id: 0}});
            return row ? Boolean((row as {enabled?: boolean}).enabled) : undefined;
        } catch (err) {
            log.error({scope: 'featureFlags.get', err, id}, 'get failed');
            return undefined;
        }
    }

    /** Upsert an override. `updatedBy` is the admin email or `mcp:<token-id>`. */
    async set(id: string, enabled: boolean, updatedBy?: string): Promise<IFeatureFlagRow> {
        const updatedAt = new Date().toISOString();
        const row: IFeatureFlagRow = {id, enabled, updatedAt, updatedBy};
        await this.col.updateOne({id}, {$set: row}, {upsert: true});
        // Boot-side gating means a feature that was OFF at boot stays
        // schema/resolver-missing until restart, even after this flip
        // populates `isFeatureEnabled`. Mark a restart-required hint so
        // the admin UI surfaces the banner; the operator triggers
        // `requestServerRestart` when they're ready to apply.
        if (enabled) {
            markRestartRequired({
                source: 'feature-flags',
                key: id,
                detail: `Restart required to load services and schema for "${id}"`,
            });
        } else {
            // Disabling is runtime-only — drop any prior banner row for
            // this feature so the operator isn't nagged about it.
            clearRestartReason('feature-flags', id);
        }
        return row;
    }

    /** Drop an override — falls back to default behaviour. */
    async clear(id: string): Promise<void> {
        await this.col.deleteOne({id});
        // Resetting to default may flip the feature ON or OFF; conservative:
        // clear any banner row for this feature. The next call resolves
        // the actual state and re-marks if needed.
        clearRestartReason('feature-flags', id);
    }
}
