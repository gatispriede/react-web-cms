/**
 * W8c — Suppression list service.
 *
 * Single source of truth for "do NOT send to this address". Reads /
 * writes the `EmailSuppression` Mongo collection. Used by:
 *   - EmailService pre-send check (skips sends to suppressed recipients)
 *   - Resend webhook handler (writes hard-bounces + spam complaints)
 *   - Unsubscribe landing (W8f one-click; `kind: manual-unsubscribe`)
 *   - Admin pane (manual add / remove)
 *   - MCP `email.suppression.list/remove`
 *
 * Soft bounces get an `expiresAt` (default 14 days, configurable) — they
 * lift automatically so a transient mailbox-full doesn't permanently
 * block legitimate users. Hard bounces + complaints never expire on
 * their own; an operator has to remove them.
 */

import type {Collection, Db} from 'mongodb';
import type {
    IEmailSuppression,
    EmailSuppressionKind,
} from '@interfaces/IEmailSuppression';

const COLLECTION = 'EmailSuppression';

const DEFAULT_SOFT_BOUNCE_TTL_DAYS = 14;

function normalise(email: string): string {
    return String(email ?? '').trim().toLowerCase();
}

export interface AddSuppressionInput {
    email: string;
    kind: EmailSuppressionKind;
    reason?: string;
    addedBy?: string;
    sourceMessageId?: string;
    /** Override default TTL for soft bounces. Days. */
    ttlDays?: number;
}

export class SuppressionListService {
    private col: Collection<IEmailSuppression>;
    private indexesReady = false;

    constructor(db: Db) {
        this.col = db.collection<IEmailSuppression>(COLLECTION);
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.col.createIndex({email: 1}, {unique: true});
            await this.col.createIndex({addedAt: -1});
            await this.col.createIndex({kind: 1});
            // Auto-expire soft bounces. `expiresAt` is sparse — only
            // soft-bounce rows carry it, so hard bounces / complaints
            // survive indefinitely.
            await this.col.createIndex(
                {expiresAt: 1},
                {expireAfterSeconds: 0, sparse: true},
            );
        } catch {
            /* index errors are non-fatal; logged below on first write */
        }
        this.indexesReady = true;
    }

    async isSuppressed(email: string): Promise<{
        suppressed: boolean;
        row?: IEmailSuppression;
    }> {
        const e = normalise(email);
        if (!e) return {suppressed: false};
        await this.ensureIndexes();
        const row = await this.col.findOne({email: e});
        if (!row) return {suppressed: false};
        // Defensive: if `expiresAt` slipped past index reaping, treat as gone.
        if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
            return {suppressed: false};
        }
        return {suppressed: true, row};
    }

    async add(input: AddSuppressionInput): Promise<IEmailSuppression> {
        await this.ensureIndexes();
        const email = normalise(input.email);
        if (!email) throw new Error('SuppressionListService.add: email required');
        const now = new Date().toISOString();
        const doc: IEmailSuppression = {
            email,
            kind: input.kind,
            reason: input.reason,
            addedAt: now,
            addedBy: input.addedBy ?? 'system',
            sourceMessageId: input.sourceMessageId,
        };
        if (input.kind === 'bounced-soft') {
            const days = input.ttlDays ?? DEFAULT_SOFT_BOUNCE_TTL_DAYS;
            doc.expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
        }
        await this.col.updateOne(
            {email},
            {$set: doc},
            {upsert: true},
        );
        return doc;
    }

    async remove(email: string): Promise<boolean> {
        await this.ensureIndexes();
        const e = normalise(email);
        if (!e) return false;
        const res = await this.col.deleteOne({email: e});
        return res.deletedCount > 0;
    }

    async list(opts: {limit?: number; kind?: EmailSuppressionKind; q?: string} = {}): Promise<IEmailSuppression[]> {
        await this.ensureIndexes();
        const filter: Record<string, unknown> = {};
        if (opts.kind) filter.kind = opts.kind;
        if (opts.q) filter.email = {$regex: opts.q.toLowerCase().replace(/[^\w@.+-]/g, ''), $options: 'i'};
        const cursor = this.col
            .find(filter)
            .sort({addedAt: -1})
            .limit(Math.min(Math.max(opts.limit ?? 100, 1), 500));
        return cursor.toArray();
    }

    async count(): Promise<number> {
        return this.col.estimatedDocumentCount();
    }
}
