/**
 * Client-side facade for the Permissions feature. Wraps the existing
 * `grantPermission` / `revokePermission` GraphQL mutations and the
 * `permissionsForUser` query — no new server endpoints. The 4-tier UX
 * and the feature/page/locale grant-grid are both client-side
 * translation layers on top of the row-keyed engine (per
 * `docs/roadmap/admin/admin-permissions-ux.md`).
 *
 * Uses raw `fetch` instead of gqty.resolve to dodge the same
 * mutation-hang bug we hit with `removeUser` + `listThemes` (see
 * `services/api/client/UserApi.ts` header).
 */
import {resolve} from '@services/api/generated';
import {log} from '@services/infra/logger';

export interface GrantRow {
    id: string;
    userId: string;
    scope: string;
    resourceId: string;
    grantedBy?: string;
    grantedAt?: string;
}

/**
 * The three constrained option catalogues that back the grant-grid —
 * feature flags, page slugs, locale codes. Pulled from the live
 * registries so the grid only ever offers real values (per
 * coding-principle 2026-05-03: predefined selections beat free text).
 */
export interface GrantCatalogues {
    features: string[];
    pages: string[];
    locales: string[];
}

async function gql(query: string): Promise<any> {
    const r = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query}),
    });
    return r.json();
}

export class PermissionsApi {
    /**
     * List every engine grant row across all known users. The grant-grid
     * + tier grid both read from the `Permissions` collection — keyed on
     * `(userId, scope, resourceId)` — surfaced per-user by the
     * `permissionsForUser` query. We fan out one query per user id so the
     * list view can show grant counts and the editor can pre-fill.
     */
    async listGrants(userIds: string[]): Promise<GrantRow[]> {
        try {
            const rows: GrantRow[] = [];
            await Promise.all(userIds.map(async (userId) => {
                const json = await gql(
                    `{ mongo { permissionsForUser(userId: ${JSON.stringify(userId)}) } }`,
                );
                const raw = json?.data?.mongo?.permissionsForUser;
                if (!raw) return;
                let parsed: any;
                try { parsed = JSON.parse(raw); } catch { return; }
                if (!Array.isArray(parsed)) return;
                for (const g of parsed) {
                    if (!g?.scope || !g?.resourceId) continue;
                    rows.push({
                        id: g.id ?? `${userId}:${g.scope}:${g.resourceId}`,
                        userId,
                        scope: String(g.scope),
                        resourceId: String(g.resourceId),
                        grantedBy: g.grantedBy,
                        grantedAt: g.grantedAt,
                    });
                }
            }));
            return rows;
        } catch (err) {
            log.error({scope: 'permissions.list', err}, 'listGrants failed');
            return [];
        }
    }

    /**
     * Pull the three grant-grid option catalogues. Failures are swallowed
     * per-source — a partial catalogue is better than crashing the pane
     * on one missing endpoint (same resilience shape as
     * `UsersViewModel.refreshGrantOptions`).
     */
    async listCatalogues(): Promise<GrantCatalogues> {
        const out: GrantCatalogues = {features: [], pages: [], locales: []};
        try {
            const flags = await gql(`{ mongo { getFeatureFlags } }`);
            const list: Array<{id: string}> = JSON.parse(flags?.data?.mongo?.getFeatureFlags ?? '[]');
            out.features = list.map(f => f.id).sort();
        } catch { /* keep empty — grid still renders existing grants */ }
        try {
            const nav = await gql(`{ mongo { getNavigationCollection { page } } }`);
            const navList: Array<{page: string}> = nav?.data?.mongo?.getNavigationCollection ?? [];
            out.pages = navList.map(p => p.page).sort();
        } catch { /* keep empty */ }
        try {
            const langs = await gql(`{ mongo { getLanguages { symbol } } }`);
            const list: Array<{symbol: string}> = langs?.data?.mongo?.getLanguages ?? [];
            out.locales = list.map(l => l.symbol).filter(Boolean).sort();
        } catch { /* keep empty */ }
        return out;
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
