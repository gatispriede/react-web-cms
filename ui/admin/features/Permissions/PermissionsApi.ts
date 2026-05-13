/**
 * Client-side facade for the Permissions feature. Wraps the existing
 * `grantPermission` / `revokePermission` GraphQL mutations and the
 * `getUsers` query — no new server endpoints. The 4-tier UX is a
 * client-side translation layer on top of the row-keyed engine
 * (per `docs/roadmap/admin/admin-permissions-ux.md`).
 *
 * Uses raw `fetch` instead of gqty.resolve to dodge the same
 * mutation-hang bug we hit with `removeUser` + `listThemes` (see
 * `services/api/client/UserApi.ts` header).
 */
import {resolve} from '@services/api/generated';
import {IUser} from '@interfaces/IUser';
import {log} from '@services/infra/logger';

export interface GrantRow {
    id: string;
    userId: string;
    scope: string;
    resourceId: string;
    grantedBy?: string;
    grantedAt?: string;
}

export class PermissionsApi {
    async listGrants(): Promise<GrantRow[]> {
        try {
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    query: `{ mongo { getUsers } }`,
                }),
            });
            const json = await r.json();
            // Grants are not exposed as a top-level query — derive them
            // from the existing user list. Each user carries their own
            // grants via the Q10 path. For collection-scoped (engine)
            // rows we keep a parallel client-cache via `mongo.getUser`
            // calls in the editor; the list view shows summary counts
            // only.
            const raw = json?.data?.mongo?.getUsers ?? [];
            const rows: GrantRow[] = [];
            for (const u of raw) {
                const grants: any[] = u.grants ?? [];
                for (const g of grants) {
                    if (!g.scope || !g.resourceId) continue;
                    rows.push({
                        id: g.id ?? `${u.id}:${g.scope}:${g.resourceId}`,
                        userId: u.id,
                        scope: g.scope,
                        resourceId: g.resourceId,
                        grantedBy: g.grantedBy,
                        grantedAt: g.grantedAt,
                    });
                }
            }
            return rows;
        } catch (err) {
            log.error({scope: 'permissions.list', err}, 'listGrants failed');
            return [];
        }
    }

    async grant(opts: {userId: string; scope: string; resourceId: string}): Promise<{error?: string}> {
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.grantPermission({
                userId: opts.userId,
                scope: opts.scope,
                resourceId: opts.resourceId,
            }));
            const parsed = JSON.parse(raw || '{}');
            if (parsed.error) return {error: String(parsed.error)};
            return {};
        } catch (err) {
            return {error: String(err)};
        }
    }

    async revoke(opts: {userId: string; scope: string; resourceId: string}): Promise<{error?: string}> {
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.revokePermission({
                userId: opts.userId,
                scope: opts.scope,
                resourceId: opts.resourceId,
            }));
            const parsed = JSON.parse(raw || '{}');
            if (parsed.error) return {error: String(parsed.error)};
            return {};
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default PermissionsApi;
