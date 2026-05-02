import {Collection, Db} from 'mongodb';
import {IAnalyticsEvent, ANALYTICS_LIMITS} from '@interfaces/IAnalytics';
import {log} from '@services/infra/logger';

/**
 * Lightweight analytics ingest + canned summaries.
 * Per `docs/features/platform/client-analytics.md` (decision 2026-05-02).
 *
 * Storage: one collection `Analytics` with a 90-day TTL on `ts`. Indexes
 * cover the dashboard's canned queries (top pages last 7d, top events,
 * funnel counts). Daily rollup is deferred until traffic warrants it.
 *
 * Privacy: customer email / name NEVER on a row. `userId` is the only
 * user-identifying field; correlation lives in the Users collection.
 * IP is captured in the request log but discarded post-ingest after the
 * country-code lookup (deferred to a follow-up — for now `country` is
 * passed-through if the client's `Accept-Language` helper supplies it).
 */

const RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS) || 90;

interface RateBucket {
    windowStart: number;
    count: number;
}

const rateBuckets = new Map<string, RateBucket>();

function ratelimitOk(anonId: string): boolean {
    const now = Date.now();
    const bucket = rateBuckets.get(anonId);
    if (!bucket || now - bucket.windowStart > ANALYTICS_LIMITS.RATE_LIMIT_WINDOW_MS) {
        rateBuckets.set(anonId, {windowStart: now, count: 1});
        return true;
    }
    bucket.count += 1;
    if (bucket.count > ANALYTICS_LIMITS.RATE_LIMIT_EVENTS) {
        return false;
    }
    return true;
}

/** Strip + clamp incoming events. Returns `null` if the row is unsalvageable. */
function sanitiseEvent(raw: any, userId: string | undefined): IAnalyticsEvent | null {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' ? raw.id.slice(0, 64) : '';
    const ts = typeof raw.ts === 'number' ? raw.ts : Date.now();
    const anonId = typeof raw.anonId === 'string' ? raw.anonId.slice(0, 64) : '';
    const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.slice(0, 64) : '';
    const path = typeof raw.path === 'string' ? raw.path.slice(0, ANALYTICS_LIMITS.PATH_LEN) : '/';
    const name = typeof raw.name === 'string' ? raw.name.slice(0, ANALYTICS_LIMITS.NAME_LEN) : '';
    const type: IAnalyticsEvent['type'] =
        raw.type === 'pageview' || raw.type === 'interaction' || raw.type === 'custom'
            ? raw.type
            : 'custom';
    if (!id || !anonId || !name) return null;

    let props: Record<string, string | number | boolean> | undefined;
    if (raw.props && typeof raw.props === 'object') {
        const entries = Object.entries(raw.props).slice(0, ANALYTICS_LIMITS.PROPS_KEYS);
        const out: Record<string, string | number | boolean> = {};
        for (const [k, v] of entries) {
            if (typeof v === 'string') out[k.slice(0, 64)] = v.slice(0, ANALYTICS_LIMITS.PROP_VALUE_LEN);
            else if (typeof v === 'number' && Number.isFinite(v)) out[k.slice(0, 64)] = v;
            else if (typeof v === 'boolean') out[k.slice(0, 64)] = v;
            // else: drop — strict allowlist.
        }
        if (Object.keys(out).length > 0) props = out;
    }

    const event: IAnalyticsEvent = {
        id,
        ts,
        serverTs: Date.now(),
        anonId,
        userId,
        sessionId,
        path,
        type,
        name,
    };
    if (raw.referrer && typeof raw.referrer === 'string') event.referrer = raw.referrer.slice(0, 512);
    if (props) event.props = props;
    if (raw.ua && typeof raw.ua === 'object') {
        const device = raw.ua.device;
        if (device === 'mobile' || device === 'tablet' || device === 'desktop') {
            event.ua = {device, browser: typeof raw.ua.browser === 'string' ? raw.ua.browser.slice(0, 64) : undefined};
        }
    }
    if (raw.viewport && typeof raw.viewport === 'object'
        && typeof raw.viewport.w === 'number' && typeof raw.viewport.h === 'number') {
        event.viewport = {w: raw.viewport.w | 0, h: raw.viewport.h | 0};
    }
    if (raw.locale && typeof raw.locale === 'string') event.locale = raw.locale.slice(0, 16);
    if (raw.country && typeof raw.country === 'string' && /^[A-Z]{2}$/.test(raw.country)) event.country = raw.country;
    return event;
}

export class AnalyticsService {
    private readonly col: Collection;

    constructor(db: Db) {
        this.col = db.collection('Analytics');
    }

    /**
     * Ingest a batch of client-supplied events. Returns the number of
     * events accepted; rejected rows (rate limit, validation) are
     * silently dropped — no client-visible error so abusers can't probe.
     */
    async ingest(rawEvents: unknown[], userId?: string): Promise<{accepted: number}> {
        if (!Array.isArray(rawEvents) || rawEvents.length === 0) return {accepted: 0};
        const batch = rawEvents.slice(0, ANALYTICS_LIMITS.BATCH_SIZE);
        const cleaned: IAnalyticsEvent[] = [];
        for (const raw of batch) {
            const ev = sanitiseEvent(raw, userId);
            if (!ev) continue;
            if (!ratelimitOk(ev.anonId)) continue;
            cleaned.push(ev);
        }
        if (cleaned.length === 0) return {accepted: 0};
        try {
            await this.col.insertMany(cleaned as any, {ordered: false});
        } catch (err) {
            // `ordered: false` keeps inserts going past dup-key collisions
            // (same `id` accepted twice — happens on client retries).
            log.warn({scope: 'analytics.ingest', err, attempted: cleaned.length}, 'partial ingest');
        }
        return {accepted: cleaned.length};
    }

    /**
     * Canned summary — top pages + top events + (later) funnel counts
     * for the requested range. The dashboard + MCP tool both call here.
     * `range` accepts `'24h' | '7d' | '30d'`; falls back to 7d.
     */
    async summary(range: string): Promise<string> {
        const since = new Date(Date.now() - rangeMs(range));
        try {
            const [topPages, topEvents] = await Promise.all([
                this.col.aggregate([
                    {$match: {type: 'pageview', ts: {$gte: since.getTime()}}},
                    {$group: {_id: '$path', count: {$sum: 1}}},
                    {$sort: {count: -1}},
                    {$limit: 10},
                    {$project: {_id: 0, path: '$_id', count: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: {type: {$ne: 'pageview'}, ts: {$gte: since.getTime()}}},
                    {$group: {_id: '$name', count: {$sum: 1}}},
                    {$sort: {count: -1}},
                    {$limit: 10},
                    {$project: {_id: 0, name: '$_id', count: 1}},
                ]).toArray(),
            ]);
            return JSON.stringify({range, since: since.toISOString(), topPages, topEvents});
        } catch (err) {
            log.error({scope: 'analytics.summary', err}, 'summary failed');
            return JSON.stringify({error: 'summary failed'});
        }
    }

    static retentionSeconds(): number {
        return RETENTION_DAYS * 24 * 60 * 60;
    }
}

function rangeMs(range: string): number {
    if (range === '24h') return 24 * 60 * 60 * 1000;
    if (range === '30d') return 30 * 24 * 60 * 60 * 1000;
    return 7 * 24 * 60 * 60 * 1000;
}
