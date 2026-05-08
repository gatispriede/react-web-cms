/**
 * PermissionResolver — joins raw `Permissions` rows against the page /
 * section graph so admin tooling can show "edit Home" instead of
 * "edit nav-x82h…". Powers `permission.list { includeResources }`.
 *
 * Per `IPermission` (`shared/types/IPermission.ts`):
 *   - `scope: 'page'`     → `resourceId` is `Navigation.page` (the slug)
 *   - `scope: 'module'`   → `resourceId` is `Sections.id`
 *   - `scope: 'element'`  → free-form (translation key, etc.) — not resolvable
 *
 * The resolver returns `resourceLabel: null` for unresolved rows; callers
 * choose whether to render the raw id or hide the row.
 */

export interface PermissionGrantInput {
    id: string;
    userId: string;
    scope: string;
    resourceId?: string | null;
}

export interface PermissionPageInput {
    id: string;
    page: string;
}

export interface PermissionSectionInput {
    id: string;
    page?: string;
}

export interface ResolvedPermission {
    id: string;
    userId: string;
    scope: string;
    resourceId?: string | null;
    /** Human-readable name — null if unresolved or scope doesn't have one. */
    resourceLabel: string | null;
}

export function resolvePermissions(args: {
    grants: readonly PermissionGrantInput[];
    pages: readonly PermissionPageInput[];
    sections?: readonly PermissionSectionInput[];
}): ResolvedPermission[] {
    // `resourceId` for page-scope grants is the page slug itself
    // (per the IPermission docstring), but historic data has used the
    // navigation `id` too. Build both lookup tables so either form
    // resolves correctly.
    const pageIdToName = new Map<string, string>();
    const pageNames = new Set<string>();
    for (const p of args.pages) {
        pageIdToName.set(p.id, p.page);
        pageNames.add(p.page);
    }
    const sectionIdToPage = new Map<string, string | undefined>();
    for (const s of args.sections ?? []) {
        sectionIdToPage.set(s.id, s.page);
    }

    return args.grants.map(g => {
        const rid = g.resourceId ?? null;
        let label: string | null = null;
        if (rid) {
            if (g.scope === 'page') {
                if (pageNames.has(rid)) label = rid;
                else label = pageIdToName.get(rid) ?? null;
            } else if (g.scope === 'module') {
                const page = sectionIdToPage.get(rid);
                label = page ? `module on ${page}` : null;
            }
            // 'element' and unknown scopes — leave label null.
        }
        return {
            id: g.id,
            userId: g.userId,
            scope: g.scope,
            resourceId: rid,
            resourceLabel: label,
        };
    });
}

export interface PermissionResolverConnection {
    /** PermissionService doesn't ship a list-all today; callers can compose by chaining `listForUser`. */
    listAllPermissions(): Promise<Array<PermissionGrantInput>>;
    getNavigationCollection(): Promise<Array<{id: string; page: string}>>;
    getSections?(args: {ids: string[]}): Promise<Array<{id?: string; page?: string}>>;
}

export interface PermissionResolverSources {
    grants: PermissionGrantInput[];
    pages: PermissionPageInput[];
    sections: PermissionSectionInput[];
}

export async function loadPermissionResolverSources(conn: PermissionResolverConnection): Promise<PermissionResolverSources> {
    const [grants, pages] = await Promise.all([
        conn.listAllPermissions(),
        conn.getNavigationCollection(),
    ]);
    const moduleSectionIds = grants
        .filter(g => g.scope === 'module' && typeof g.resourceId === 'string')
        .map(g => g.resourceId as string);
    let sections: PermissionSectionInput[] = [];
    if (moduleSectionIds.length > 0 && conn.getSections) {
        const docs = await conn.getSections({ids: moduleSectionIds});
        sections = docs
            .filter(d => typeof d.id === 'string')
            .map(d => ({id: d.id as string, page: d.page}));
    }
    return {
        grants: grants.map(g => ({
            id: g.id,
            userId: g.userId,
            scope: g.scope,
            resourceId: g.resourceId ?? null,
        })),
        pages: pages.map(p => ({id: p.id, page: p.page})),
        sections,
    };
}
