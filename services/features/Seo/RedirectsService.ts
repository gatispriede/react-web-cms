import {Collection, Db, ObjectId} from 'mongodb';
import {auditStamp} from '@services/features/Audit/audit';
import {nextVersion, requireVersion} from '@services/infra/conflict';
import type {IRedirect} from '@interfaces/IRedirect';

/**
 * RedirectsService — W8h roadmap (seo-program § redirect map).
 *
 * Admin-editable redirect table. Exact-path matches only (v1); the
 * middleware consults a snapshot of this collection before route
 * resolution. Slug-change writes a 301 entry automatically (future
 * follow-up wired through `NavigationService.replaceUpdateNavigation`).
 *
 * Why a service vs. an inline collection helper: redirects are
 * cascading-trash-aware (a deleted page's auto-redirect must also be
 * cleaned up) and audit-logged, so we want the same auditStamp +
 * version contract every other singleton service uses.
 */
export class RedirectsService {
    private readonly redirects: Collection;

    constructor(db: Db) {
        this.redirects = db.collection('Redirects');
    }

    private normalizeFrom(from: string): string {
        const trimmed = (from ?? '').trim();
        if (!trimmed) return '';
        return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }

    private serialize(doc: any): IRedirect {
        return {
            id: doc?._id ? String(doc._id) : undefined,
            from: doc?.from,
            to: doc?.to,
            code: doc?.code === 302 ? 302 : 301,
            note: doc?.note,
            expiresAt: doc?.expiresAt ?? null,
            createdAt: doc?.createdAt,
            editedBy: doc?.editedBy,
            editedAt: doc?.editedAt,
            version: typeof doc?.version === 'number' ? doc.version : 0,
        };
    }

    async list(): Promise<IRedirect[]> {
        const docs = await this.redirects.find({}).sort({from: 1}).toArray();
        return docs.map((d) => this.serialize(d));
    }

    /**
     * Live lookup used by the edge middleware. Returns the matching row
     * or null. Skips expired entries silently. Case-sensitive — Google
     * treats `/Foo` and `/foo` as distinct, and operators are encouraged
     * to lowercase paths anyway.
     */
    async findActive(path: string): Promise<IRedirect | null> {
        const from = this.normalizeFrom(path);
        if (!from) return null;
        const doc = await this.redirects.findOne({from});
        if (!doc) return null;
        const row = this.serialize(doc);
        if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
            return null;
        }
        return row;
    }

    async create(input: IRedirect, editedBy?: string): Promise<IRedirect> {
        const from = this.normalizeFrom(input.from);
        if (!from) throw new Error('redirect.from is required');
        const to = (input.to ?? '').trim();
        if (!to) throw new Error('redirect.to is required');
        const code: 301 | 302 = input.code === 302 ? 302 : 301;
        const existing = await this.redirects.findOne({from});
        if (existing) throw new Error(`redirect already exists for ${from}`);
        const now = new Date().toISOString();
        const insert = {
            from,
            to,
            code,
            note: input.note ?? '',
            expiresAt: input.expiresAt ?? null,
            createdAt: now,
            version: 1,
            ...auditStamp(editedBy),
        };
        const res = await this.redirects.insertOne(insert as any);
        return this.serialize({_id: res.insertedId, ...insert});
    }

    async update(input: IRedirect, editedBy?: string): Promise<IRedirect> {
        if (!input.id) throw new Error('redirect.id is required');
        let oid: ObjectId;
        try { oid = new ObjectId(input.id); }
        catch { throw new Error('redirect.id must be a valid ObjectId'); }
        const existing = await this.redirects.findOne({_id: oid});
        if (!existing) throw new Error(`redirect ${input.id} not found`);
        const existingVersion = (existing as any).version as number | undefined;
        requireVersion(existing, existingVersion, input.version, 'Redirect');
        const next = {
            from: this.normalizeFrom(input.from || (existing as any).from),
            to: (input.to ?? (existing as any).to).trim(),
            code: (input.code === 302 ? 302 : 301) as 301 | 302,
            note: input.note ?? (existing as any).note ?? '',
            expiresAt: input.expiresAt === undefined ? (existing as any).expiresAt ?? null : input.expiresAt,
            version: nextVersion(existingVersion),
            ...auditStamp(editedBy),
        };
        // If `from` is changing, defend against accidental clobber of a
        // sibling row.
        if (next.from !== (existing as any).from) {
            const sibling = await this.redirects.findOne({from: next.from});
            if (sibling) throw new Error(`redirect already exists for ${next.from}`);
        }
        await this.redirects.updateOne({_id: oid}, {$set: next});
        return this.serialize({...existing, ...next, _id: oid});
    }

    async delete(id: string): Promise<{deleted: boolean}> {
        if (!id) throw new Error('redirect.id is required');
        let oid: ObjectId;
        try { oid = new ObjectId(id); }
        catch { throw new Error('redirect.id must be a valid ObjectId'); }
        const res = await this.redirects.deleteOne({_id: oid});
        return {deleted: res.deletedCount > 0};
    }
}
