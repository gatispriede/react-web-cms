import {Collection, Db} from 'mongodb';
import {UAParser} from 'ua-parser-js';
import {isbot} from 'isbot';
import {IAnalyticsEvent, ANALYTICS_LIMITS, type AnalyticsAudience, type IAnalyticsUA} from '@interfaces/IAnalytics';
import {log} from '@services/infra/logger';
import {geoLookup} from './geoLookup';
import {AnalyticsFiltersService} from './AnalyticsFiltersService';

/**
 * First-party analytics ingest + dashboard aggregations.
 * Per `docs/features/platform/client-analytics.md` (decision 2026-05-02; v2 2026-05-06).
 *
 * Storage: one collection `Analytics` with a 90-day TTL on `ts`.
 *
 * v2 adds:
 *   - `audience` tagging at ingest (`public` | `admin` | `internal` | `bot`).
 *     Tagging happens at WRITE time but filtering happens at QUERY time —
 *     we never drop a row, so re-segmenting later is just a query change.
 *   - Server-side UA parsing via `ua-parser-js` (client UA from the request
 *     header, NOT from the event body — clients can't lie this way).
 *   - Daily time-series, unique-visitor, and device/OS/browser breakdowns
 *     in `summary()`. The dashboard reads them directly.
 *
 * Privacy: customer email / name NEVER on a row. `userId` is the only
 * user-identifying field. Request IP is read once at ingest, resolved
 * to a 2-letter country and consulted against the internal-IP allowlist,
 * then DISCARDED. Never written, never logged, never returned.
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

function clip(s: string | undefined, n: number = ANALYTICS_LIMITS.UA_FIELD_LEN): string | undefined {
    if (typeof s !== 'string' || !s) return undefined;
    return s.slice(0, n);
}

/**
 * Parse the HTTP `User-Agent` header into the persisted shape. Server-side
 * only — we ignore client-supplied `ua` on the event body so a hostile
 * client can't spoof its way into a different bucket.
 *
 * Returns `undefined` when no UA header was supplied (tests, internal
 * cron, etc.) — the row is still persisted, just without device data.
 */
function parseUA(uaHeader: string | undefined): IAnalyticsUA | undefined {
    if (!uaHeader) return undefined;
    const r = new UAParser(uaHeader).getResult();
    const isBot = isbot(uaHeader);
    const rawType = r.device?.type;
    let device: IAnalyticsUA['device'];
    if (isBot) device = 'bot';
    else if (rawType === 'mobile' || rawType === 'tablet') device = rawType;
    else device = 'desktop'; // ua-parser leaves `type` undefined for desktops
    return {
        device,
        browser: clip(r.browser?.name),
        browserVersion: clip(r.browser?.major),
        os: clip(r.os?.name),
        osVersion: clip(r.os?.version, 16),
        vendor: clip(r.device?.vendor),
        model: clip(r.device?.model),
    };
}

/** Strip + clamp incoming events. Returns `null` if the row is unsalvageable. */
function sanitiseEvent(raw: any, userId: string | undefined, ua: IAnalyticsUA | undefined): IAnalyticsEvent | null {
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
    if (ua) event.ua = ua;
    if (raw.viewport && typeof raw.viewport === 'object'
        && typeof raw.viewport.w === 'number' && typeof raw.viewport.h === 'number') {
        event.viewport = {w: raw.viewport.w | 0, h: raw.viewport.h | 0};
    }
    if (raw.locale && typeof raw.locale === 'string') event.locale = raw.locale.slice(0, 16);
    return event;
}

export interface IngestContext {
    /** Stamped from the calling session — never trusted from the client. */
    userId?: string;
    /** Discarded after country lookup + internal-IP check. */
    ip?: string;
    /** Raw HTTP `User-Agent` header. Server-parsed via ua-parser-js. */
    userAgent?: string;
    /** True when the calling session is admin/editor/etc (any non-customer logged-in role). */
    isAdminSession?: boolean;
}

export type AnalyticsRange = '24h' | '7d' | '30d';

export interface SummaryResult {
    range: AnalyticsRange;
    audience: AnalyticsAudience | 'all';
    since: string;
    /** Headline KPIs for the range, scoped to the audience. */
    totals: {
        pageviews: number;
        events: number;
        uniqueAnon: number;
        uniqueUsers: number;
        sessions: number;
    };
    /** Daily buckets — `[{day: '2026-05-01', pageviews, uniqueAnon, events}]`. */
    daily: Array<{day: string; pageviews: number; uniqueAnon: number; events: number}>;
    topPages: Array<{path: string; count: number}>;
    topEvents: Array<{name: string; count: number}>;
    topCountries: Array<{country: string; count: number}>;
    topReferrers: Array<{referrer: string; count: number}>;
    devices: Array<{device: string; count: number}>;
    browsers: Array<{browser: string; count: number}>;
    osFamilies: Array<{os: string; count: number}>;
    /** Audience split for THIS range (always 'all' regardless of filter). */
    audienceMix: Array<{audience: AnalyticsAudience; count: number}>;
}

export class AnalyticsService {
    private readonly col: Collection;
    public readonly filters: AnalyticsFiltersService;

    constructor(db: Db) {
        this.col = db.collection('Analytics');
        this.filters = new AnalyticsFiltersService(db);
    }

    /**
     * Ingest a batch of client-supplied events. Returns the number of
     * events accepted; rejected rows (rate limit, validation) are
     * silently dropped — no client-visible error so abusers can't probe.
     *
     * `ctx.ip` is consumed for country derivation + internal-IP match
     * and discarded. `ctx.userAgent` is parsed once per batch.
     */
    async ingest(rawEvents: unknown[], ctx: IngestContext = {}): Promise<{accepted: number}> {
        if (!Array.isArray(rawEvents) || rawEvents.length === 0) return {accepted: 0};
        const batch = rawEvents.slice(0, ANALYTICS_LIMITS.BATCH_SIZE);

        // Parse UA once per batch — it's the same for every event in
        // this HTTP request.
        const ua = parseUA(ctx.userAgent);
        const country = geoLookup(ctx.ip);
        const isInternalIp = await this.filters.isInternal(ctx.ip);
        const audience = resolveAudience({
            ua,
            isInternalIp,
            isAdminSession: ctx.isAdminSession === true,
        });

        const cleaned: IAnalyticsEvent[] = [];
        for (const raw of batch) {
            const ev = sanitiseEvent(raw, ctx.userId, ua);
            if (!ev) continue;
            if (!ratelimitOk(ev.anonId)) continue;
            if (country) ev.country = country;
            ev.audience = audience;
            cleaned.push(ev);
        }
        if (cleaned.length === 0) return {accepted: 0};
        try {
            await this.col.insertMany(cleaned as any, {ordered: false});
        } catch (err) {
            log.warn({scope: 'analytics.ingest', err, attempted: cleaned.length}, 'partial ingest');
        }
        return {accepted: cleaned.length};
    }

    /**
     * Dashboard summary for the given range + audience filter.
     * `audience: 'all'` returns everything; the dashboard's default is
     * `'public'` so admin/internal/bot traffic doesn't poison the numbers.
     *
     * Older rows pre-v2 have no `audience` field — they're treated as
     * `'public'` via `$ifNull` in the audience match stage.
     */
    async summary(range: AnalyticsRange = '7d', audience: AnalyticsAudience | 'all' = 'public'): Promise<SummaryResult> {
        const since = new Date(Date.now() - rangeMs(range));
        const sinceMs = since.getTime();
        const audienceMatch = audience === 'all'
            ? {}
            : {$expr: {$eq: [{$ifNull: ['$audience', 'public']}, audience]}};
        const baseMatch = {ts: {$gte: sinceMs}, ...audienceMatch};
        const empty: SummaryResult = {
            range, audience, since: since.toISOString(),
            totals: {pageviews: 0, events: 0, uniqueAnon: 0, uniqueUsers: 0, sessions: 0},
            daily: [], topPages: [], topEvents: [], topCountries: [], topReferrers: [],
            devices: [], browsers: [], osFamilies: [], audienceMix: [],
        };
        try {
            const [
                totalsRow,
                dailyRows,
                topPagesRows,
                topEventsRows,
                topCountriesRows,
                topReferrersRows,
                devicesRows,
                browsersRows,
                osRows,
                audienceMixRows,
            ] = await Promise.all([
                // Totals — collapse pageview / non-pageview counts +
                // distinct anonId / userId / sessionId in one pass via
                // `$facet`. Cheaper than five separate aggregates.
                this.col.aggregate([
                    {$match: baseMatch},
                    {$facet: {
                        pv: [{$match: {type: 'pageview'}}, {$count: 'n'}],
                        ev: [{$match: {type: {$ne: 'pageview'}}}, {$count: 'n'}],
                        anon: [{$group: {_id: '$anonId'}}, {$count: 'n'}],
                        users: [{$match: {userId: {$ne: null}}}, {$group: {_id: '$userId'}}, {$count: 'n'}],
                        sess: [{$group: {_id: '$sessionId'}}, {$count: 'n'}],
                    }},
                ]).toArray(),
                // Daily time-series — pageviews + events + uniques per day.
                this.col.aggregate([
                    {$match: baseMatch},
                    {$addFields: {day: {$dateToString: {format: '%Y-%m-%d', date: {$toDate: '$ts'}}}}},
                    {$group: {
                        _id: {day: '$day', anonId: '$anonId'},
                        pageviews: {$sum: {$cond: [{$eq: ['$type', 'pageview']}, 1, 0]}},
                        events: {$sum: {$cond: [{$ne: ['$type', 'pageview']}, 1, 0]}},
                    }},
                    {$group: {
                        _id: '$_id.day',
                        pageviews: {$sum: '$pageviews'},
                        events: {$sum: '$events'},
                        uniqueAnon: {$sum: 1},
                    }},
                    {$sort: {_id: 1}},
                    {$project: {_id: 0, day: '$_id', pageviews: 1, events: 1, uniqueAnon: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: {...baseMatch, type: 'pageview'}},
                    {$group: {_id: '$path', count: {$sum: 1}}},
                    {$sort: {count: -1}}, {$limit: 10},
                    {$project: {_id: 0, path: '$_id', count: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: {...baseMatch, type: {$ne: 'pageview'}}},
                    {$group: {_id: '$name', count: {$sum: 1}}},
                    {$sort: {count: -1}}, {$limit: 10},
                    {$project: {_id: 0, name: '$_id', count: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: baseMatch},
                    {$group: {_id: {$ifNull: ['$country', 'Unknown']}, count: {$sum: 1}}},
                    {$sort: {count: -1}}, {$limit: 10},
                    {$project: {_id: 0, country: '$_id', count: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: {...baseMatch, referrer: {$exists: true, $ne: ''}}},
                    {$group: {_id: '$referrer', count: {$sum: 1}}},
                    {$sort: {count: -1}}, {$limit: 10},
                    {$project: {_id: 0, referrer: '$_id', count: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: baseMatch},
                    {$group: {_id: {$ifNull: ['$ua.device', 'unknown']}, count: {$sum: 1}}},
                    {$sort: {count: -1}}, {$limit: 10},
                    {$project: {_id: 0, device: '$_id', count: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: baseMatch},
                    {$group: {_id: {$ifNull: ['$ua.browser', 'unknown']}, count: {$sum: 1}}},
                    {$sort: {count: -1}}, {$limit: 10},
                    {$project: {_id: 0, browser: '$_id', count: 1}},
                ]).toArray(),
                this.col.aggregate([
                    {$match: baseMatch},
                    {$group: {_id: {$ifNull: ['$ua.os', 'unknown']}, count: {$sum: 1}}},
                    {$sort: {count: -1}}, {$limit: 10},
                    {$project: {_id: 0, os: '$_id', count: 1}},
                ]).toArray(),
                // Audience mix is ALWAYS computed across every row in
                // the range (ignores the audience filter) so the dashboard
                // can show "Public 84%, Admin 11%, Bot 4%, Internal 1%"
                // on every chip.
                this.col.aggregate([
                    {$match: {ts: {$gte: sinceMs}}},
                    {$group: {_id: {$ifNull: ['$audience', 'public']}, count: {$sum: 1}}},
                    {$sort: {count: -1}},
                    {$project: {_id: 0, audience: '$_id', count: 1}},
                ]).toArray(),
            ]);

            const totals = totalsRow[0] as any | undefined;
            const result: SummaryResult = {
                range, audience, since: since.toISOString(),
                totals: {
                    pageviews: totals?.pv?.[0]?.n ?? 0,
                    events: totals?.ev?.[0]?.n ?? 0,
                    uniqueAnon: totals?.anon?.[0]?.n ?? 0,
                    uniqueUsers: totals?.users?.[0]?.n ?? 0,
                    sessions: totals?.sess?.[0]?.n ?? 0,
                },
                daily: dailyRows as any,
                topPages: topPagesRows as any,
                topEvents: topEventsRows as any,
                topCountries: topCountriesRows as any,
                topReferrers: topReferrersRows as any,
                devices: devicesRows as any,
                browsers: browsersRows as any,
                osFamilies: osRows as any,
                audienceMix: audienceMixRows as any,
            };
            return result;
        } catch (err) {
            log.error({scope: 'analytics.summary', err}, 'summary failed');
            return empty;
        }
    }

    static retentionSeconds(): number {
        return RETENTION_DAYS * 24 * 60 * 60;
    }
}

/**
 * Audience priority: bot > internal > admin > public. The first matching
 * signal wins — a bot User-Agent visiting from an internal IP still tags
 * `bot`, because we want to keep crawler traffic out of every other bucket.
 */
function resolveAudience(opts: {
    ua: IAnalyticsUA | undefined;
    isInternalIp: boolean;
    isAdminSession: boolean;
}): AnalyticsAudience {
    if (opts.ua?.device === 'bot') return 'bot';
    if (opts.isInternalIp) return 'internal';
    if (opts.isAdminSession) return 'admin';
    return 'public';
}

function rangeMs(range: AnalyticsRange | string): number {
    if (range === '24h') return 24 * 60 * 60 * 1000;
    if (range === '30d') return 30 * 24 * 60 * 60 * 1000;
    return 7 * 24 * 60 * 60 * 1000;
}
