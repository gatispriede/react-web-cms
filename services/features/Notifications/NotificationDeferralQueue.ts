/**
 * Polish bundle (W8f follow-up) — deferred-send queue.
 *
 * Persists notification sends that `sendWithPreference` decided to
 * defer (quiet hours) or batch (digest cadence). The two workers in
 * this folder (QuietHoursQueue, DigestCadenceWorker) own the flush
 * cadence; this module is just the storage shim so neither worker
 * needs its own Mongo plumbing.
 *
 * Lives on the `NotificationDeferrals` collection. Rows are deleted
 * after a successful flush — keeping the table small. A 7-day TTL
 * guards against stuck rows the workers never picked up (e.g. user
 * deleted, mail config broken — operator sees them in the EmailLog
 * separately).
 */

import type {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import type {NotificationCategory, DigestCadence} from '@interfaces/INotificationPreferences';
import type {EmailPayload} from '@services/features/Email/EmailService';

const COLLECTION = 'NotificationDeferrals';

export interface NotificationDeferralRow {
    id: string;
    /** Resolved user id when we know it (so the worker can re-resolve
     *  quiet-hours against fresh prefs at flush time). */
    userId?: string;
    /** Recipient email — load-bearing for the actual send. */
    to: string;
    category: NotificationCategory;
    /** Why it was deferred. */
    reason: 'quiet-hours' | DigestCadence;
    /** The payload as `sendEmail` will consume it. */
    payload: EmailPayload;
    queuedAt: Date;
}

export class NotificationDeferralQueue {
    private col: Collection<NotificationDeferralRow>;
    private indexesReady = false;

    constructor(db: Db) {
        this.col = db.collection<NotificationDeferralRow>(COLLECTION);
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.col.createIndex({reason: 1, queuedAt: 1});
            await this.col.createIndex({userId: 1});
            await this.col.createIndex({id: 1}, {unique: true});
            // 7-day stuck-row sweep.
            await this.col.createIndex({queuedAt: 1}, {expireAfterSeconds: 7 * 24 * 60 * 60});
        } catch { /* non-fatal */ }
        this.indexesReady = true;
    }

    async enqueue(input: Omit<NotificationDeferralRow, 'id' | 'queuedAt'>): Promise<string> {
        await this.ensureIndexes();
        const row: NotificationDeferralRow = {
            ...input,
            id: guid(),
            queuedAt: new Date(),
        };
        await this.col.insertOne(row as any);
        return row.id;
    }

    /** All rows queued for a given reason — workers iterate + decide
     *  per row whether to flush now. Bounded for safety. */
    async list(reason: NotificationDeferralRow['reason'], limit = 500): Promise<NotificationDeferralRow[]> {
        await this.ensureIndexes();
        return this.col.find({reason}).sort({queuedAt: 1}).limit(Math.min(limit, 2000)).toArray() as Promise<NotificationDeferralRow[]>;
    }

    async listByUser(userId: string): Promise<NotificationDeferralRow[]> {
        await this.ensureIndexes();
        return this.col.find({userId}).sort({queuedAt: 1}).toArray() as Promise<NotificationDeferralRow[]>;
    }

    async remove(id: string): Promise<void> {
        await this.col.deleteOne({id});
    }
}

let inst: NotificationDeferralQueue | null = null;
let lastDb: Db | undefined;

/** Lazy singleton — mirrors `getWarmupLimiter` / `getEmailLog` shape. */
export function getNotificationDeferralQueue(db: Db | undefined): NotificationDeferralQueue | null {
    if (!db) return null;
    if (db !== lastDb) {
        inst = null;
        lastDb = db;
    }
    if (!inst) inst = new NotificationDeferralQueue(db);
    return inst;
}

export function _resetNotificationDeferralQueueForTests(): void {
    inst = null;
    lastDb = undefined;
}
