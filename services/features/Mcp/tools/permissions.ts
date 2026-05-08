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

export const permissionList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct service read
    name: 'permission.list',
    description: 'List resource-scoped permission grants. Optional filter by `userId` and/or `scope`.',
    scopes: ['admin:auth'],
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string'},
            scope: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    if (typeof args.userId === 'string' && args.userId.length > 0) {
        const rows = await ctx.services.permissionService.listForUser(args.userId);
        return typeof args.scope === 'string'
            ? rows.filter((r: any) => r.scope === args.scope)
            : rows;
    }
    // Whole-collection read — admin-only diagnostic surface.
    const all = await ctx.services.permissionService['col']
        ?.find({}, {projection: {_id: 0}}).toArray() ?? [];
    return typeof args.scope === 'string'
        ? all.filter((r: any) => r.scope === args.scope)
        : all;
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

export const PERMISSION_TOOLS: McpTool[] = [permissionList, permissionGrant, permissionRevoke];
