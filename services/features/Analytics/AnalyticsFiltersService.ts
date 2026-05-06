import {Collection, Db} from 'mongodb';
import type {IAnalyticsFilters} from '@interfaces/IAnalytics';
import {log} from '@services/infra/logger';

/**
 * Admin-editable IP allowlist that drives the `audience: 'internal'` tag.
 * Per `docs/features/platform/client-analytics.md` v2 (2026-05-06).
 *
 * One document, id `'default'`, lives in collection `AnalyticsFilters`.
 * Read on every ingest call (cached in-process, 60s TTL — cheap to do
 * because we keep the doc tiny). Admins manage the list at
 * `/admin/system/analytics-filters`.
 *
 * Why exact-match (not CIDR): the use-case is "filter ourselves out" —
 * a handful of office / VPN / static home IPs. CIDR adds parsing,
 * version (v4/v6) handling, and an attack surface. Add it later if a
 * real corporate network needs it.
 */

const DOC_ID = 'default';
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
    at: number;
    set: Set<string>;
}

export class AnalyticsFiltersService {
    private readonly col: Collection<IAnalyticsFilters>;
    private cache: CacheEntry | null = null;

    constructor(db: Db) {
        this.col = db.collection<IAnalyticsFilters>('AnalyticsFilters');
    }

    /**
     * Returns the current filter document. Always resolves — when the
     * collection is empty, returns an empty default doc (no error).
     */
    async get(): Promise<IAnalyticsFilters> {
        const doc = await this.col.findOne({_id: DOC_ID as any});
        return doc ?? {_id: DOC_ID, internalIps: [], labels: {}};
    }

    /**
     * Replace the allowlist wholesale. The admin UI sends the complete
     * desired state; partial-update / patch isn't worth the ceremony for
     * a list this small. Bumps `updatedAt` + stamps `updatedBy` for the
     * audit row.
     */
    async update(input: {internalIps: string[]; labels?: Record<string, string>; editedBy?: string}): Promise<IAnalyticsFilters> {
        const cleaned = Array.from(new Set(input.internalIps.map(ip => ip.trim()).filter(Boolean))).slice(0, 200);
        const labels: Record<string, string> = {};
        if (input.labels) {
            for (const [ip, label] of Object.entries(input.labels)) {
                if (cleaned.includes(ip) && typeof label === 'string') {
                    labels[ip] = label.slice(0, 128);
                }
            }
        }
        const next: IAnalyticsFilters = {
            _id: DOC_ID,
            internalIps: cleaned,
            labels,
            updatedAt: Date.now(),
            updatedBy: input.editedBy?.slice(0, 256),
        };
        await this.col.replaceOne({_id: DOC_ID as any}, next, {upsert: true});
        // Bust the cache eagerly so the very next ingest sees the change.
        this.cache = null;
        return next;
    }

    /**
     * Hot path. Returns true when the IP is on the allowlist. Cached
     * 60s in-process — every ingest call hits this once per batch, so a
     * fresh Mongo round-trip per call would be expensive on a busy box.
     */
    async isInternal(ip: string | undefined): Promise<boolean> {
        if (!ip) return false;
        const set = await this.loadSet();
        return set.has(ip);
    }

    private async loadSet(): Promise<Set<string>> {
        const now = Date.now();
        if (this.cache && now - this.cache.at < CACHE_TTL_MS) return this.cache.set;
        try {
            const doc = await this.col.findOne({_id: DOC_ID as any});
            const set = new Set<string>(doc?.internalIps ?? []);
            this.cache = {at: now, set};
            return set;
        } catch (err) {
            log.warn({scope: 'analytics.filters.load', err}, 'filter load failed; treating as empty');
            // Fail-open (treat as empty): better to over-count internal
            // traffic for one minute than to drop the whole ingest.
            const set = new Set<string>();
            this.cache = {at: now, set};
            return set;
        }
    }
}
