import {Collection} from 'mongodb';
import {log} from '@services/infra/logger';

/**
 * AdminAuthService — admin-side identity helpers extracted from the
 * pre-split monolithic NextAuth callback bag (see
 * `ui/client/pages/api/auth/authOptions.ts` history).
 *
 * After `auth-split-client-admin` (Phase 1.A), the two NextAuth
 * instances live in separate files (`/api/auth/[...nextauth].ts` for
 * customers, `/api/admin/auth/[...nextauth].ts` for admins). The
 * provider-level credential check stays in the route file (it owns
 * the bcrypt + lockout machinery against the live request), but
 * helpers that are useful across the admin surface — session
 * invalidation, role lookups — live here so MCP tools + admin
 * settings panes have a stable import surface.
 *
 * Shares the `Users` collection with `CustomerAuthService` (one
 * document per human, `kind` discriminator splits domains). Customer
 * helpers stay in `CustomerAuthService`; this service is admin-only.
 */
export class AdminAuthService {
    constructor(private readonly usersDB: Collection) {}

    /**
     * Invalidate all sessions for one admin user.
     *
     * Strategy: bump a per-user `sessionEpoch` counter on the `Users`
     * doc. The JWT callback in `adminAuthOptions` stamps the issuing
     * epoch into the token at sign-in; the `session` callback rejects
     * any token whose epoch is below the current value. The next
     * request after invalidation is forced through `/admin/signin`.
     *
     * Returns the new epoch number so callers (MCP `auth.session.invalidate`)
     * can audit-log the bump.
     */
    async invalidateSessions(userId: string): Promise<{ok: true; epoch: number} | {ok: false; error: string}> {
        try {
            const res = await this.usersDB.findOneAndUpdate(
                {id: userId, kind: {$ne: 'customer'}},
                {$inc: {sessionEpoch: 1}},
                {returnDocument: 'after'},
            );
            const epoch = (res as any)?.sessionEpoch ?? (res as any)?.value?.sessionEpoch ?? 1;
            if (!epoch) return {ok: false, error: 'user not found'};
            return {ok: true, epoch};
        } catch (err) {
            log.error({scope: 'admin.invalidateSessions', err, userId}, 'invalidateSessions failed');
            return {ok: false, error: String((err as Error).message || err)};
        }
    }

    /**
     * Look up a single admin user's role + publish flag. Used by
     * MCP `auth.providers.list` to surface "who can sign in as admin"
     * counts without leaking password hashes.
     */
    async getAdminSummary(email: string): Promise<{role: string; canPublishProduction: boolean} | null> {
        const u = await this.usersDB.findOne({email, kind: {$ne: 'customer'}});
        if (!u) return null;
        return {
            role: (u as any).role ?? 'viewer',
            canPublishProduction: Boolean((u as any).canPublishProduction),
        };
    }
}
