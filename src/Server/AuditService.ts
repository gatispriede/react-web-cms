import {Collection, Db} from 'mongodb';
import guid from '../helpers/guid';

/**
 * Append-only audit log for mutation traceability. Complements the inline
 * `{editedBy, editedAt}` stamps every editable doc already carries — those
 * only show *last* touch, while this collection preserves the chronology
 * so editors can answer "who broke the footer last Tuesday?" without
 * digging through git history or Mongo oplog.
 *
 * Retention: 90 days by default (`AUDIT_LOG_RETENTION_DAYS` env override).
 * TTL index on `at` lets Mongo drop old rows automatically. Diff payload
 * is size-capped so bundle imports don't flood the collection with a
 * single 50 MB doc.
 *
 * Writes are fire-and-forget from the caller's perspective — any error
 * inside `record()` is swallowed with a console.error so an audit-system
 * outage never blocks the underlying mutation.
 */
export interface AuditActor {
    email?: string;
    role?: string;
}

export type AuditOp = 'create' | 'update' | 'delete';

export interface AuditEntry {
    id: string;
    at: Date;
    actor: AuditActor;
    collection: string;
    docId?: string;
    op: AuditOp;
    /** Optional — may be null for deletes, oversize changes, or bulk ops. */
    diff?: {before?: unknown; after?: unknown} | null;
    /** Free-form tag for bulk operations so related rows can be grouped in the UI. */
    tag?: string;
}

const MAX_DIFF_BYTES = 10_000;

function retentionSeconds(): number {
    const days = Number(process.env.AUDIT_LOG_RETENTION_DAYS);
    const safe = Number.isFinite(days) && days > 0 ? days : 90;
    return safe * 24 * 60 * 60;
}

export class AuditService {
    private audit: Collection;
    private indexesReady = false;

    constructor(db: Db) {
        this.audit = db.collection('AuditLog');
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.audit.createIndex({at: -1});
            await this.audit.createIndex({collection: 1, docId: 1, at: -1});
            await this.audit.createIndex({'actor.email': 1, at: -1});
            await this.audit.createIndex({at: 1}, {expireAfterSeconds: retentionSeconds()});
            this.indexesReady = true;
        } catch (err) {
            console.error('AuditService.ensureIndexes:', err);
        }
    }

    async record(entry: Omit<AuditEntry, 'id' | 'at'> & {at?: Date}): Promise<void> {
        try {
            await this.ensureIndexes();
            const diff = this.safeDiff(entry.diff);
            const row: AuditEntry = {
                id: guid(),
                at: entry.at ?? new Date(),
                actor: entry.actor ?? {},
                collection: entry.collection,
                docId: entry.docId,
                op: entry.op,
                diff,
                tag: entry.tag,
            };
            await this.audit.insertOne(row as any);
        } catch (err) {
            // Never let audit failures block the caller's mutation.
            console.error('AuditService.record:', err);
        }
    }

    async list(params: {
        actorEmail?: string;
        collection?: string;
        docId?: string;
        op?: AuditOp;
        since?: Date;
        until?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{rows: AuditEntry[]; total: number}> {
        await this.ensureIndexes();
        const filter: any = {};
        if (params.actorEmail) filter['actor.email'] = params.actorEmail;
        if (params.collection) filter.collection = params.collection;
        if (params.docId) filter.docId = params.docId;
        if (params.op) filter.op = params.op;
        if (params.since || params.until) {
            filter.at = {};
            if (params.since) filter.at.$gte = params.since;
            if (params.until) filter.at.$lte = params.until;
        }
        const limit = Math.min(Math.max(1, params.limit ?? 100), 500);
        const offset = Math.max(0, params.offset ?? 0);
        const [rows, total] = await Promise.all([
            this.audit.find(filter).sort({at: -1}).skip(offset).limit(limit).toArray(),
            this.audit.countDocuments(filter),
        ]);
        return {
            rows: rows.map(d => this.stripMongoId(d)) as AuditEntry[],
            total,
        };
    }

    async listCollections(): Promise<string[]> {
        await this.ensureIndexes();
        const res = await this.audit.distinct('collection');
        return res.filter(v => typeof v === 'string') as string[];
    }

    async listActors(): Promise<string[]> {
        await this.ensureIndexes();
        const res = await this.audit.distinct('actor.email');
        return res.filter(v => typeof v === 'string') as string[];
    }

    private stripMongoId(doc: any): AuditEntry {
        const {_id, ...rest} = doc ?? {};
        return rest as AuditEntry;
    }

    private safeDiff(diff: AuditEntry['diff']): AuditEntry['diff'] {
        if (!diff) return diff ?? null;
        try {
            const serialised = JSON.stringify(diff);
            if (serialised.length > MAX_DIFF_BYTES) {
                // Oversize — keep the keys but drop the bodies so the UI can
                // still show "something changed" without blowing up a bundle
                // import. Consumers can check `diff: null` for the "too big
                // to capture" case.
                return null;
            }
            return diff;
        } catch {
            return null;
        }
    }
}
