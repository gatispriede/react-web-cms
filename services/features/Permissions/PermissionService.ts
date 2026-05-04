import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {IPermission, PermissionScope} from '@interfaces/IPermission';
import {log} from '@services/infra/logger';

/**
 * PermissionService — CRUD over the `Permissions` collection + `can()`
 * predicate consulted by `guardMethods` (per-resource hook, follow-up).
 * Per `docs/features/platform/edit-levels.md` (decisions 2026-05-02).
 *
 *   - Admins bypass — `role: 'admin'` short-circuits to true (decision 1).
 *   - Levels are independent — page-edit on /about does NOT imply
 *     module-edit on its sections (decision 2). Each `(scope, resourceId)`
 *     check is exact.
 *   - Creator-owns-on-create — `grantOnCreate()` writes a row at the
 *     creator's scope (decision 3). Called by feature services when a
 *     non-admin creates a resource.
 *   - Per-request cache — `can()` reads through `RequestPermissionCache`
 *     when the caller passes one (decision 6). The cache's TTL is the
 *     request lifetime; no cross-request invalidation needed.
 */
export class PermissionService {
    private readonly col: Collection;

    constructor(db: Db) {
        this.col = db.collection('Permissions');
    }

    /** List every grant for a user. Admin "show me my access" surface. */
    async listForUser(userId: string): Promise<IPermission[]> {
        try {
            const rows = await this.col
                .find({userId}, {projection: {_id: 0}})
                .toArray();
            return rows as unknown as IPermission[];
        } catch (err) {
            log.error({scope: 'permissions.listForUser', err, userId}, 'listForUser failed');
            return [];
        }
    }

    /** Check whether `userId` has `scope` access to `resourceId`. */
    async can(opts: {
        userId: string;
        userRole?: 'admin' | 'editor' | 'viewer';
        scope: PermissionScope;
        resourceId: string;
        cache?: RequestPermissionCache;
    }): Promise<boolean> {
        // Decision 1 — admins bypass per-resource gates.
        if (opts.userRole === 'admin') return true;
        const cacheKey = `${opts.userId}:${opts.scope}:${opts.resourceId}`;
        if (opts.cache) {
            const cached = opts.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }
        try {
            const row = await this.col.findOne({
                userId: opts.userId,
                scope: opts.scope,
                resourceId: opts.resourceId,
            });
            const result = !!row;
            opts.cache?.set(cacheKey, result);
            return result;
        } catch (err) {
            log.error({scope: 'permissions.can', err, userId: opts.userId, resourceScope: opts.scope, resourceId: opts.resourceId}, 'can() failed');
            // Fail closed — denial is safer than open access.
            return false;
        }
    }

    /** Grant a permission. Idempotent — re-granting the same row is a no-op. */
    async grant(opts: {
        userId: string;
        scope: PermissionScope;
        resourceId: string;
        grantedBy: string;
    }): Promise<IPermission> {
        const row: IPermission = {
            id: guid(),
            userId: opts.userId,
            scope: opts.scope,
            resourceId: opts.resourceId,
            grantedBy: opts.grantedBy,
            grantedAt: new Date().toISOString(),
        };
        // Upsert on the natural key — same user + scope + resource = same row.
        const filter = {userId: opts.userId, scope: opts.scope, resourceId: opts.resourceId};
        await this.col.updateOne(filter, {$setOnInsert: row}, {upsert: true});
        const stored = await this.col.findOne(filter, {projection: {_id: 0}}) as unknown as IPermission;
        return stored ?? row;
    }

    /** Revoke a permission. Idempotent — revoking a missing row is a no-op. */
    async revoke(opts: {userId: string; scope: PermissionScope; resourceId: string}): Promise<{deleted: number}> {
        const result = await this.col.deleteOne({
            userId: opts.userId,
            scope: opts.scope,
            resourceId: opts.resourceId,
        });
        return {deleted: result.deletedCount ?? 0};
    }

    /**
     * "Creator gets the grant" helper (decision 3). Called by feature
     * services when a non-admin user creates a new resource — page,
     * module instance, etc. — so the creator can keep editing without
     * an admin re-grant. Admin-rank creators don't need this; the
     * caller skips the call when `userRole === 'admin'`.
     */
    async grantOnCreate(opts: {
        userId: string;
        scope: PermissionScope;
        resourceId: string;
    }): Promise<void> {
        await this.grant({...opts, grantedBy: opts.userId});
    }
}

/**
 * Per-request cache (decision 6). The GraphQL context constructor builds
 * one; every `can()` call inside the request reads it. Map-backed; lifetime
 * ends with the request — no invalidation needed.
 */
export class RequestPermissionCache {
    private readonly cache = new Map<string, boolean>();
    get(key: string): boolean | undefined { return this.cache.get(key); }
    set(key: string, value: boolean): void { this.cache.set(key, value); }
    /** For tests + diagnostics. */
    size(): number { return this.cache.size; }
}
