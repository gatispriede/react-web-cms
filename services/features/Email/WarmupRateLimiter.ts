/**
 * W8c — Per-day send-rate warmup limiter.
 *
 * Fresh sending domains get a ramping daily cap so ISPs see gradual
 * volume growth (reduces spam-folder placement). Enabled only when both
 *   - `EMAIL_WARMUP_ENABLED` === 'true'
 *   - `EMAIL_WARMUP_START_DATE` is a parseable ISO date
 * are set. Otherwise `canSend` always returns `{ok: true, capToday: Infinity}`.
 *
 * Counts live in `EmailWarmupCounters` (one doc per day, total across
 * all sends from this process). Sends past the daily cap are skipped
 * with a sentinel — callers can retry the next day's window. We
 * intentionally don't queue — a persistent queue is out of W8c scope
 * (callers that need durable delivery should use the W8f digest /
 * quiet-hours path).
 */

import type {Collection, Db} from 'mongodb';

interface WarmupCounterDoc {
    day: string; // YYYY-MM-DD
    count: number;
    updatedAt: Date;
}

const COLLECTION = 'EmailWarmupCounters';

/**
 * Daily ramp curve. Day index = floor((now - startDate) / 1d). After
 * the last entry, cap is `Infinity` (no limit).
 */
export const WARMUP_RAMP: ReadonlyArray<{untilDay: number; cap: number}> = [
    {untilDay: 3,  cap: 1_000},
    {untilDay: 7,  cap: 5_000},
    {untilDay: 14, cap: 25_000},
    {untilDay: 21, cap: 100_000},
    {untilDay: 30, cap: 250_000},
];

function todayKey(): string {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function dayIndex(startMs: number): number {
    return Math.floor((Date.now() - startMs) / 86_400_000);
}

export function capForDay(d: number): number {
    for (const rule of WARMUP_RAMP) {
        if (d <= rule.untilDay) return rule.cap;
    }
    return Number.POSITIVE_INFINITY;
}

export function warmupEnabled(): boolean {
    return String(process.env.EMAIL_WARMUP_ENABLED ?? '').toLowerCase() === 'true';
}

export function warmupStartMs(): number | null {
    const raw = process.env.EMAIL_WARMUP_START_DATE;
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
}

export interface WarmupStatus {
    enabled: boolean;
    startDate?: string;
    dayIndex?: number;
    capToday: number;
    sentToday: number;
    remaining: number;
}

export class WarmupRateLimiter {
    private col: Collection<WarmupCounterDoc>;
    private indexesReady = false;

    constructor(db: Db) {
        this.col = db.collection<WarmupCounterDoc>(COLLECTION);
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.col.createIndex({day: 1}, {unique: true});
        } catch { /* non-fatal */ }
        this.indexesReady = true;
    }

    /** Read-only — does NOT increment. */
    async status(): Promise<WarmupStatus> {
        if (!warmupEnabled()) {
            return {enabled: false, capToday: Number.POSITIVE_INFINITY, sentToday: 0, remaining: Number.POSITIVE_INFINITY};
        }
        const start = warmupStartMs();
        if (start === null) {
            return {enabled: false, capToday: Number.POSITIVE_INFINITY, sentToday: 0, remaining: Number.POSITIVE_INFINITY};
        }
        await this.ensureIndexes();
        const d = Math.max(0, dayIndex(start));
        const cap = capForDay(d);
        const row = await this.col.findOne({day: todayKey()});
        const sent = row?.count ?? 0;
        return {
            enabled: true,
            startDate: new Date(start).toISOString(),
            dayIndex: d,
            capToday: cap,
            sentToday: sent,
            remaining: Math.max(0, cap - sent),
        };
    }

    /** Reserve one send slot. Returns `{ok: true}` when under cap. */
    async canSend(): Promise<{ok: boolean; capToday: number; sentToday: number}> {
        const s = await this.status();
        return {ok: s.sentToday < s.capToday, capToday: s.capToday, sentToday: s.sentToday};
    }

    /** Record one successful send. No-op when warmup is disabled. */
    async recordSend(): Promise<void> {
        if (!warmupEnabled() || warmupStartMs() === null) return;
        await this.ensureIndexes();
        await this.col.updateOne(
            {day: todayKey()},
            {$inc: {count: 1}, $set: {updatedAt: new Date()}},
            {upsert: true},
        );
    }
}
