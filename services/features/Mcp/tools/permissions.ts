/**
 * F8 Week-2 — permission grants (list / grant / revoke).
 *
 * Resource-scoped grants (per `docs/features/platform/edit-levels.md`)
 * — admin-only operations, all destructive ones idempotent. The grant
 * service is already idempotent on its natural key
 * (userId + scope + resourceId), so re-issuing the same grant is a
 * no-op even without `idempotencyKey`.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool, runBatch} from './_shared';
import {resolvePermissions} from '@services/features/Permissions/PermissionResolver';

export const permissionList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct service read
    name: 'permission.list',
    description: 'List resource-scoped permission grants. Optional filter by `userId` and/or `scope`. Set `includeResources:true` to also annotate each grant with a human-readable `resourceLabel` (page name, "module on <page>", or null).',
    scopes: ['admin:auth'],
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string'},
            scope: {type: 'string'},
            includeResources: {type: 'boolean', description: 'When true, joins grants against pages + sections and adds `resourceLabel` to every row.'},
        },
    },
}, async (args, ctx) => {
    let rows: any[];
    if (typeof args.userId === 'string' && args.userId.length > 0) {
        rows = await ctx.services.permissionService.listForUser(args.userId);
        if (typeof args.scope === 'string') rows = rows.filter((r: any) => r.scope === args.scope);
    } else {
        const all = await ctx.services.permissionService['col']
            ?.find({}, {projection: {_id: 0}}).toArray() ?? [];
        rows = typeof args.scope === 'string'
            ? all.filter((r: any) => r.scope === args.scope)
            : all;
    }
    if (!args.includeResources) return rows;
    const pages = (await ctx.services.navigationService?.getNavigationCollection?.()) ?? [];
    const moduleIds = rows
        .filter((r: any) => r.scope === 'module' && typeof r.resourceId === 'string')
        .map((r: any) => r.resourceId);
    const sectionDocs = moduleIds.length
        ? (await ctx.services.navigationService?.getSections?.(moduleIds)) ?? []
        : [];
    const resolved = resolvePermissions({
        grants: rows.map((r: any) => ({
            id: String(r.id ?? ''),
            userId: String(r.userId ?? ''),
            scope: String(r.scope ?? ''),
            resourceId: r.resourceId ?? null,
        })),
        pages: (pages as Array<{id: string; page: string}>).map(p => ({id: p.id, page: p.page})),
        sections: (sectionDocs as Array<{id?: string; page?: string}>)
            .filter(d => typeof d.id === 'string')
            .map(d => ({id: d.id as string, page: d.page})),
    });
    const byKey = new Map(resolved.map(r => [`${r.userId}:${r.scope}:${r.resourceId ?? ''}`, r]));
    return rows.map((r: any) => {
        const key = `${r.userId}:${r.scope}:${r.resourceId ?? ''}`;
        const found = byKey.get(key);
        return {...r, resourceLabel: found?.resourceLabel ?? null};
    });
});

export const permissionGrant: McpTool = defineTool({
    name: 'permission.grant',
    description: 'Grant one or many (userId, scope, resourceId) permissions. Single form: pass {userId, scope, resourceId}. Bulk form: pass {items: {userId, scope, resourceId?}[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. Idempotent — re-granting is a no-op. Reference: image.delete { ids[] }.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'grantPermission',
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string', minLength: 1},
            scope: {type: 'string', minLength: 1},
            resourceId: {type: 'string', minLength: 1},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        userId: {type: 'string', minLength: 1},
                        scope: {type: 'string', minLength: 1},
                        resourceId: {type: 'string', minLength: 1},
                    },
                },
                description: 'Bulk variant. Up to 500 items. Mutually exclusive with single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'permission.grant');
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({
            id: `${it?.userId ?? 'idx'}:${it?.scope ?? ''}:${it?.resourceId ?? ''}:${i}`,
            payload: it,
        }))
        : (typeof args.userId === 'string' && typeof args.scope === 'string' && typeof args.resourceId === 'string'
            ? [{id: `${args.userId}:${args.scope}:${args.resourceId}`, payload: args}]
            : []);
    if (!items.length) {
        throw new Error('permission.grant requires (userId+scope+resourceId) or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (_id, payload) => {
        const result = await ctx.services.permissionService.grant({
            userId: payload.userId,
            scope: payload.scope,
            resourceId: payload.resourceId,
            grantedBy: ctx.actor,
        });
        return {result};
    });
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

export const permissionRevoke: McpTool = defineTool({
    name: 'permission.revoke',
    description: 'Revoke one or many (userId, scope, resourceId) permissions. Single form: pass {userId, scope, resourceId}. Bulk form: pass {items: {userId, scope, resourceId?}[]}. Bulk returns per-item failures via `data.failed[]`. Idempotent — revoking a missing row is a no-op. Reference: image.delete { ids[] }.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'revokePermission',
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string', minLength: 1},
            scope: {type: 'string', minLength: 1},
            resourceId: {type: 'string', minLength: 1},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        userId: {type: 'string', minLength: 1},
                        scope: {type: 'string', minLength: 1},
                        resourceId: {type: 'string', minLength: 1},
                    },
                },
                description: 'Bulk variant. Up to 500 items. Mutually exclusive with single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'permission.revoke');
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({
            id: `${it?.userId ?? 'idx'}:${it?.scope ?? ''}:${it?.resourceId ?? ''}:${i}`,
            payload: it,
        }))
        : (typeof args.userId === 'string' && typeof args.scope === 'string' && typeof args.resourceId === 'string'
            ? [{id: `${args.userId}:${args.scope}:${args.resourceId}`, payload: args}]
            : []);
    if (!items.length) {
        throw new Error('permission.revoke requires (userId+scope+resourceId) or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (_id, payload) => {
        const result = await ctx.services.permissionService.revoke({
            userId: payload.userId,
            scope: payload.scope,
            resourceId: payload.resourceId,
        });
        return {result};
    });
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

/**
 * `permission.applyTier` — UX-convenience tool that maps the 4-tier model
 * (Full / Edit / Comment / View) used by the admin permissions pane onto
 * the engine's `(scope, resourceId)` rows. Same as the client-side
 * `tierToGrants` translator, surfaced to MCP so agents can speak the
 * tier vocabulary directly.
 *
 * Per `docs/roadmap/admin/admin-permissions-ux.md`:
 *   - View / Comment  → no engine grant rows (reads are open)
 *   - Edit            → grant `(scope, resourceId='*')`
 *   - Full            → same as Edit; publish/delete are role-rank gated
 *                       on the user doc (not modelled per-tier yet)
 *
 * Idempotent — applying the same tier twice is a no-op against the
 * underlying rows.
 */
const TIER_VALUES = ['Full', 'Edit', 'Comment', 'View'] as const;
type Tier = typeof TIER_VALUES[number];

export const permissionApplyTier: McpTool = defineTool({
    name: 'permission.applyTier',
    description: 'Set a tier (Full / Edit / Comment / View) for a user on a scope. Expands the tier into the granular `(scope, resourceId)` grants the engine consumes — View/Comment removes the wildcard row, Edit/Full upserts it. Use this instead of `permission.grant` when agents speak the tier vocabulary surfaced by the admin pane.',
    scopes: ['admin:auth'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string', minLength: 1},
            scope: {type: 'string', minLength: 1, description: 'Engine scope — `page` / `module` / `element`.'},
            tier: {type: 'string', enum: [...TIER_VALUES]},
            idempotencyKey: {type: 'string'},
        },
        required: ['userId', 'scope', 'tier'],
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'permission.applyTier');
    const tier = args.tier as Tier;
    const wildcardResource = '*';
    if (tier === 'Edit' || tier === 'Full') {
        await ctx.services.permissionService.grant({
            userId: args.userId,
            scope: args.scope,
            resourceId: wildcardResource,
            grantedBy: ctx.actor,
        });
        return {ok: true, tier, applied: 'grant'};
    }
    // View / Comment — strip the wildcard row if present (per-resource
    // override rows are left alone; operators manage those explicitly).
    await ctx.services.permissionService.revoke({
        userId: args.userId,
        scope: args.scope,
        resourceId: wildcardResource,
    });
    return {ok: true, tier, applied: 'revoke'};
});

/**
 * `permission.applyGrant` — MCP coverage for the admin grant-grid.
 *
 * The grant-grid (admin Permissions pane) edits the Q10 three-dimension
 * `Grant` union — `feature` / `page` / `locale` — per
 * `docs/roadmap/admin/admin-permissions-ux.md`. Each grid cell persists
 * as an engine `Permissions` row under the dimension name as the
 * `scope` string (`grantScopeFor` on the client). This tool is the
 * MCP-side parity for that surface: agents grant/revoke a single
 * `(dimension, resourceId)` cell with the same vocabulary the grid
 * speaks, so the canonical write path covers the grant-grid the same
 * way `permission.applyTier` covers the tier grid.
 *
 * Idempotent — `set:true` re-granting an existing row is a no-op,
 * `set:false` revoking a missing row is a no-op.
 */
const GRANT_DIMENSIONS = ['feature', 'page', 'locale'] as const;
type GrantDimension = typeof GRANT_DIMENSIONS[number];

export const permissionApplyGrant: McpTool = defineTool({
    name: 'permission.applyGrant',
    description: 'Grant or revoke a single feature/page/locale dimension grant for a user — the MCP parity for the admin grant-grid. `dimension` is one of `feature` / `page` / `locale`; `resourceId` is the feature flag id, page slug, or locale code; `set:true` grants the cell, `set:false` revokes it. Each cell persists as an engine `Permissions` row under the dimension name as `scope`. Idempotent.',
    scopes: ['admin:auth'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string', minLength: 1},
            dimension: {type: 'string', enum: [...GRANT_DIMENSIONS], description: 'Grant dimension — `feature` / `page` / `locale`.'},
            resourceId: {type: 'string', minLength: 1, description: 'Feature flag id, page slug, or locale code.'},
            set: {type: 'boolean', description: 'true → grant the cell; false → revoke it.'},
            idempotencyKey: {type: 'string'},
        },
        required: ['userId', 'dimension', 'resourceId', 'set'],
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'permission.applyGrant');
    const dimension = args.dimension as GrantDimension;
    // The dimension name *is* the engine scope string — mirrors the
    // client-side `grantScopeFor` convention so the grid + MCP write the
    // same rows. The engine `scope` column is a free `String!` (the
    // `PermissionScope` union is advisory only — see `permission.applyTier`,
    // which likewise hands the service an unconstrained scope).
    if (args.set) {
        const row = await ctx.services.permissionService.grant({
            userId: args.userId,
            scope: args.dimension,
            resourceId: args.resourceId,
            grantedBy: ctx.actor,
        });
        return {ok: true, dimension, resourceId: args.resourceId, applied: 'grant', row};
    }
    const result = await ctx.services.permissionService.revoke({
        userId: args.userId,
        scope: args.dimension,
        resourceId: args.resourceId,
    });
    return {ok: true, dimension, resourceId: args.resourceId, applied: 'revoke', deleted: result.deleted};
});

export const PERMISSION_TOOLS: McpTool[] = [
    permissionList,
    permissionGrant,
    permissionRevoke,
    permissionApplyTier,
    permissionApplyGrant,
];
