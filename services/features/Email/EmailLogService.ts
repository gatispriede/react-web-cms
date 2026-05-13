/**
 * W8c — Lightweight email-event log used by the deliverability dashboard.
 *
 * Two collections:
 *   - `EmailLog`         — one row per outbound send attempt
 *   - `EmailEventLog`    — one row per inbound webhook event
 *
 * Aggregations are computed on-the-fly (no materialised view) — volume
 * stays modest for a single-tenant CMS, and Mongo handles the per-day
 * group-by fine without indexing tricks. Bounded by `EMAIL_LOG_RETENTION_DAYS`
 * (default 90) via TTL index on `ts`.
 */

import type {Collection, Db} from 'mongodb';

const LOG_COLLECTION = 'EmailLog';
const EVENT_COLLECTION = 'EmailEventLog';

function retentionSeconds(): number {
    const days = Number(process.env.EMAIL_LOG_RETENTION_DAYS);
    const safe = Number.isFinite(days) && days > 0 ? days : 90;
    return safe * 86_400;
}

export type EmailSendOutcome = 'sent' | 'suppressed' | 'warmup-skipped' | 'failed';
export type EmailEventType =
    | 'email.sent'
    | 'email.delivered'
    | 'email.opened'
    | 'email.clicked'
    | 'email.bounced'
    | 'email.complained'
    | 'email.delivery_delayed';

export interface EmailLogRow {
    ts: Date;
    to: string;
    from?: string;
    subject?: string;
    provider?: string;
    outcome: EmailSendOutcome;
    messageId?: string;
    error?: string;
    durationMs?: number;
    /** Free-form caller tag — `notif:order-receipt` / `mcp:test` etc. */
    tag?: string;
}

export interface EmailEventRow {
    ts: Date;
    type: EmailEventType;
    to: string;
    messageId?: string;
    bounceType?: 'hard' | 'soft' | string;
    diagnostic?: string;
    raw?: Record<string, unknown>;
}

export class EmailLogService {
    private logs: Collection<EmailLogRow>;
    private events: Collection<EmailEventRow>;
    private indexesReady = false;

    constructor(db: Db) {
        this.logs = db.collection<EmailLogRow>(LOG_COLLECTION);
        this.events = db.collection<EmailEventRow>(EVENT_COLLECTION);
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.logs.createIndex({ts: -1});
            await this.logs.createIndex({to: 1, ts: -1});
            await this.logs.createIndex({ts: 1}, {expireAfterSeconds: retentionSeconds()});
            await this.events.createIndex({ts: -1});
            await this.events.createIndex({to: 1, ts: -1});
            await this.events.createIndex({messageId: 1});
            await this.events.createIndex({ts: 1}, {expireAfterSeconds: retentionSeconds()});
        } catch { /* non-fatal */ }
        this.indexesReady = true;
    }

    async recordSend(row: Omit<EmailLogRow, 'ts'> & {ts?: Date}): Promise<void> {
        await this.ensureIndexes();
        try {
            await this.logs.insertOne({...row, ts: row.ts ?? new Date()});
        } catch { /* swallow — log isn't load-bearing */ }
    }

    async recordEvent(row: Omit<EmailEventRow, 'ts'> & {ts?: Date}): Promise<void> {
        await this.ensureIndexes();
        try {
            await this.events.insertOne({...row, ts: row.ts ?? new Date()});
        } catch { /* swallow */ }
    }

    async recentSends(limit = 100): Promise<EmailLogRow[]> {
        await this.ensureIndexes();
        return this.logs.find({}).sort({ts: -1}).limit(Math.min(Math.max(limit, 1), 500)).toArray();
    }

    async historyFor(email: string, limit = 25): Promise<{sends: EmailLogRow[]; events: EmailEventRow[]}> {
        await this.ensureIndexes();
        const e = email.trim().toLowerCase();
        const [sends, events] = await Promise.all([
            this.logs.find({to: e}).sort({ts: -1}).limit(limit).toArray(),
            this.events.find({to: e}).sort({ts: -1}).limit(limit).toArray(),
        ]);
        return {sends, events};
    }

    /**
     * 24h aggregate counters used by the admin dashboard. Computed live
     * across `EmailLog` + `EmailEventLog`. Single-tenant volumes don't
     * justify a materialised view yet.
     */
    async stats24h(): Promise<{
        sends: number;
        suppressed: number;
        failed: number;
        warmupSkipped: number;
        bounced: number;
        complained: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounceRate: number;
        complaintRate: number;
    }> {
        await this.ensureIndexes();
        const since = new Date(Date.now() - 86_400_000);
        const [logsAgg, eventsAgg] = await Promise.all([
            this.logs.aggregate<{_id: EmailSendOutcome; n: number}>([
                {$match: {ts: {$gte: since}}},
                {$group: {_id: '$outcome', n: {$sum: 1}}},
            ]).toArray(),
            this.events.aggregate<{_id: EmailEventType; n: number}>([
                {$match: {ts: {$gte: since}}},
                {$group: {_id: '$type', n: {$sum: 1}}},
            ]).toArray(),
        ]);
        const log: Record<string, number> = {};
        for (const row of logsAgg) log[row._id] = row.n;
        const evt: Record<string, number> = {};
        for (const row of eventsAgg) evt[row._id] = row.n;
        const sends = (log['sent'] ?? 0);
        const denom = Math.max(sends, 1);
        return {
            sends,
            suppressed: log['suppressed'] ?? 0,
            failed: log['failed'] ?? 0,
            warmupSkipped: log['warmup-skipped'] ?? 0,
            bounced: evt['email.bounced'] ?? 0,
            complained: evt['email.complained'] ?? 0,
            delivered: evt['email.delivered'] ?? 0,
            opened: evt['email.opened'] ?? 0,
            clicked: evt['email.clicked'] ?? 0,
            bounceRate: (evt['email.bounced'] ?? 0) / denom,
            complaintRate: (evt['email.complained'] ?? 0) / denom,
        };
    }
}
