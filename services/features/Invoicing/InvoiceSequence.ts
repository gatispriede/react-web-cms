/**
 * Gap-free invoice + credit-note numbering.
 *
 * Stores one row per (prefix, year) in the `InvoiceSequences` collection.
 * `next()` uses `findOneAndUpdate({...}, {$inc: {seq: 1}}, {upsert: true,
 * returnDocument: 'after'})` so concurrent callers always read a unique
 * incremented value — the Mongo atomicity guarantees gap-free output
 * even with 100 parallel finalize calls. We deliberately do NOT delete
 * sequence rows; voided invoices stay numbered (a credit note voids
 * them) per EU invoicing-directive 2010/45/EU.
 *
 * Prefix defaults — `INV-` for invoices, `CN-` for credit notes — are
 * operator-overridable via `SITE_INVOICE_PREFIX` / `SITE_CREDIT_NOTE_PREFIX`.
 * Per-year reset on Jan 1 (in the operator's wall-clock timezone via
 * `SITE_TIMEZONE`, defaulting to UTC).
 */

import type {Collection, Db} from 'mongodb';

export interface InvoiceSequenceConfig {
    /** Prefix excluding the trailing dash, e.g. `INV` or `CN`. */
    prefix: string;
    /** Zero-pad width, default 6 (`INV-2026-000001`). */
    pad?: number;
    /** Override the "now" clock — tests only. */
    now?: () => Date;
}

const COLLECTION = 'InvoiceSequences';

export class InvoiceSequence {
    private readonly col: Collection;
    private readonly prefix: string;
    private readonly pad: number;
    private readonly now: () => Date;

    constructor(db: Db, cfg: InvoiceSequenceConfig) {
        this.col = db.collection(COLLECTION);
        this.prefix = cfg.prefix;
        this.pad = cfg.pad ?? 6;
        this.now = cfg.now ?? (() => new Date());
    }

    /** Year used for the sequence reset. Honours `SITE_TIMEZONE` when set, UTC otherwise. */
    private currentYear(): number {
        const d = this.now();
        const tz = (process.env.SITE_TIMEZONE || '').trim();
        if (!tz) return d.getUTCFullYear();
        try {
            const fmt = new Intl.DateTimeFormat('en-US', {timeZone: tz, year: 'numeric'});
            return Number(fmt.format(d));
        } catch {
            return d.getUTCFullYear();
        }
    }

    /**
     * Atomically increment + read the sequence for the current
     * (prefix, year). Returns the rendered number string.
     *
     * Race-safe — `findOneAndUpdate` is a single Mongo operation; even
     * with 100 parallel callers every return value is unique. Concurrent
     * test: see `InvoiceSequence.test.ts`.
     */
    async next(): Promise<string> {
        const year = this.currentYear();
        const filter = {prefix: this.prefix, year};
        const res = await this.col.findOneAndUpdate(
            filter as any,
            {$inc: {seq: 1}, $setOnInsert: {prefix: this.prefix, year}} as any,
            {upsert: true, returnDocument: 'after'} as any,
        );
        // Driver typings vary — Mongo Node v6 returns the doc directly,
        // v5 wraps it in `{value}`. Normalise.
        const doc = (res && (res as any).value !== undefined) ? (res as any).value : res;
        const seq = Number((doc as any)?.seq ?? 0);
        if (!seq) throw new Error('InvoiceSequence: failed to obtain next seq');
        return `${this.prefix}-${year}-${String(seq).padStart(this.pad, '0')}`;
    }

    /** Read-only peek — does NOT increment. Used by tests and the admin pane. */
    async peek(): Promise<{prefix: string; year: number; seq: number}> {
        const year = this.currentYear();
        const doc = await this.col.findOne({prefix: this.prefix, year} as any);
        return {prefix: this.prefix, year, seq: Number((doc as any)?.seq ?? 0)};
    }
}

/** Default operator prefix overrides. */
export function defaultInvoicePrefix(): string {
    return (process.env.SITE_INVOICE_PREFIX || 'INV').trim() || 'INV';
}

export function defaultCreditNotePrefix(): string {
    return (process.env.SITE_CREDIT_NOTE_PREFIX || 'CN').trim() || 'CN';
}
