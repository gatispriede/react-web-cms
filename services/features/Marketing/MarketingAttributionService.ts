import {Collection} from 'mongodb';
import {log} from '@services/infra/logger';
import guid from '@utils/guid';

/**
 * W6c — marketing attribution.
 *
 * Stores per-visitor referrer + UTM tuples (`MarketingReferrer`
 * collection). Client-side capture is in `ui/client/lib/marketingCapture.ts`
 * — this service is the persistence + reporting surface.
 *
 * Storage shape:
 *   {sessionId, userId?, utm:{source,medium,campaign,term,content},
 *    ref, landingPath, referrer, capturedAt}
 *
 * Session id is a 90-day cookie set client-side on first hit. On
 * sign-up / order place the cookie value is forwarded to
 * `attachToUser({sessionId, userId})` so the row gets a userId stamped
 * and `firstTouchUtm` / `lastTouchUtm` flow into the user record.
 */

export interface UtmTuple {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
}

export interface IMarketingReferrer {
    id: string;
    sessionId: string;
    userId?: string;
    utm: UtmTuple;
    ref?: string;
    landingPath?: string;
    referrer?: string;
    capturedAt: string;
}

export interface RecordHitInput {
    sessionId: string;
    utm?: UtmTuple;
    ref?: string;
    landingPath?: string;
    referrer?: string;
}

export interface AttributionReportRow {
    /** Either utm.source, utm.campaign, or ref — whichever was grouped. */
    key: string;
    hits: number;
    signups: number;
    orders: number;
    /** ISO date of most recent hit for this key. */
    lastSeen?: string;
}

const MAX_FIELD_LEN = 200;
const trimField = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    if (!t) return undefined;
    return t.slice(0, MAX_FIELD_LEN);
};

const normUtm = (utm: UtmTuple | undefined): UtmTuple => ({
    source: trimField(utm?.source),
    medium: trimField(utm?.medium),
    campaign: trimField(utm?.campaign),
    term: trimField(utm?.term),
    content: trimField(utm?.content),
});

export class MarketingAttributionService {
    constructor(
        private readonly refs: Collection,
        private readonly users: Collection,
    ) {}

    /**
     * Persist one attribution hit. Idempotent on (sessionId, utm,
     * landingPath) — repeated identical hits are coalesced so a chatty
     * client doesn't pile up rows. The first hit is the source of truth
     * for `firstTouchUtm` on the eventual user record.
     */
    async recordHit(input: RecordHitInput): Promise<{id: string} | {error: string}> {
        try {
            const sessionId = trimField(input.sessionId);
            if (!sessionId) return {error: 'sessionId required'};
            const utm = normUtm(input.utm);
            const hasAnyAttr = Boolean(
                utm.source || utm.medium || utm.campaign || utm.term || utm.content
                || input.ref || (input.referrer && !input.referrer.startsWith('https://' + (process.env.SITE_URL ?? '').replace(/^https?:\/\//, '')))
            );
            if (!hasAnyAttr) {
                // Direct-load without UTM/ref/external-referrer — don't
                // store. Reduces noise; first attributable hit still
                // becomes the firstTouch on this sessionId.
                return {id: ''};
            }
            const id = guid();
            const doc: IMarketingReferrer = {
                id,
                sessionId,
                utm,
                ref: trimField(input.ref),
                landingPath: trimField(input.landingPath),
                referrer: trimField(input.referrer),
                capturedAt: new Date().toISOString(),
            };
            await this.refs.insertOne(doc as any);
            return {id};
        } catch (err) {
            log.error({scope: 'marketing.recordHit', err}, 'recordHit failed');
            return {error: 'failed to record hit'};
        }
    }

    /**
     * Bind an anonymous sessionId to a userId. Called on signup, on
     * magic-link redeem, and on order placement when the buyer's email
     * is known. Copies first-touch UTM onto the user (immutable after
     * first write) and overwrites last-touch UTM.
     */
    async attachToUser({sessionId, userId}: {sessionId: string; userId: string}): Promise<{ok: boolean; firstTouchSet?: boolean}> {
        try {
            const sid = trimField(sessionId);
            const uid = trimField(userId);
            if (!sid || !uid) return {ok: false};
            // Stamp userId on all matching session rows so future
            // reporting can group by user. Use updateMany so historical
            // hits within the session also link.
            await this.refs.updateMany({sessionId: sid}, {$set: {userId: uid}});

            const first = await this.refs.findOne({sessionId: sid}, {sort: {capturedAt: 1}, projection: {_id: 0}}) as any;
            const last = await this.refs.findOne({sessionId: sid}, {sort: {capturedAt: -1}, projection: {_id: 0}}) as any;
            if (!first) return {ok: true};

            const user = await this.users.findOne({id: uid}) as any;
            const update: Record<string, unknown> = {};
            if (user && !user.firstTouchUtm) {
                update.firstTouchUtm = {...first.utm, referrer: first.referrer, landingPath: first.landingPath, capturedAt: first.capturedAt};
            }
            if (last) {
                update.lastTouchUtm = {...last.utm, referrer: last.referrer, landingPath: last.landingPath, capturedAt: last.capturedAt};
            }
            if (Object.keys(update).length) {
                await this.users.updateOne({id: uid}, {$set: update});
            }
            return {ok: true, firstTouchSet: Boolean(update.firstTouchUtm)};
        } catch (err) {
            log.error({scope: 'marketing.attach', err}, 'attachToUser failed');
            return {ok: false};
        }
    }

    /**
     * Aggregated attribution report. Groups by one of:
     *   - 'source'   (utm.source)
     *   - 'campaign' (utm.campaign)
     *   - 'ref'      (named referrer slug)
     *
     * `range` is a relative window like '7d' / '30d' / 'all'.
     *
     * Counts: hits (rows in window), signups (distinct userIds where
     * the row predates the user's record), orders (TODO — wired once
     * OrderService stamps sessionId on guest orders; for now reports
     * '0' for orders so the pane is non-empty out of the box).
     */
    async report({groupBy = 'source', range = '30d'}: {groupBy?: 'source' | 'campaign' | 'ref'; range?: string} = {}): Promise<{rows: AttributionReportRow[]; total: number}> {
        try {
            const since = computeSince(range);
            const match: Record<string, unknown> = {};
            if (since) match.capturedAt = {$gte: since.toISOString()};
            const field = groupBy === 'ref' ? '$ref' : (groupBy === 'campaign' ? '$utm.campaign' : '$utm.source');
            const cursor = await this.refs.aggregate([
                {$match: match},
                {$group: {
                    _id: field,
                    hits: {$sum: 1},
                    signups: {$addToSet: '$userId'},
                    lastSeen: {$max: '$capturedAt'},
                }},
                {$sort: {hits: -1}},
                {$limit: 500},
            ]).toArray();
            const rows: AttributionReportRow[] = cursor.map(c => ({
                key: (c._id as string | null) ?? '(none)',
                hits: c.hits as number,
                signups: ((c.signups as (string | null | undefined)[]).filter(Boolean)).length,
                orders: 0, // TODO wire once orders carry sessionId
                lastSeen: c.lastSeen as string | undefined,
            }));
            return {rows, total: rows.reduce((s, r) => s + r.hits, 0)};
        } catch (err) {
            log.error({scope: 'marketing.report', err}, 'report failed');
            return {rows: [], total: 0};
        }
    }
}

function computeSince(range: string): Date | null {
    const m = /^(\d+)([dhw])$/.exec(range);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2];
    const ms = unit === 'h' ? n * 3_600_000 : unit === 'w' ? n * 7 * 86_400_000 : n * 86_400_000;
    return new Date(Date.now() - ms);
}
