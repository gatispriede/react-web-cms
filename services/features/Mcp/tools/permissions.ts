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
import {defineTool} from './_shared';

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
    description: 'Grant a (userId, scope, resourceId) permission. Idempotent — re-granting is a no-op.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'grantPermission',
    inputSchema: {
        type: 'object',
        required: ['userId', 'scope', 'resourceId'],
        properties: {
            userId: {type: 'string', minLength: 1},
            scope: {type: 'string', minLength: 1},
            resourceId: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'permission.grant');
    return ctx.services.permissionService.grant({
        userId: args.userId,
        scope: args.scope,
        resourceId: args.resourceId,
        grantedBy: ctx.actor,
    });
});

export const permissionRevoke: McpTool = defineTool({
    name: 'permission.revoke',
    description: 'Revoke a (userId, scope, resourceId) permission. Idempotent — revoking a missing row is a no-op.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'revokePermission',
    inputSchema: {
        type: 'object',
        required: ['userId', 'scope', 'resourceId'],
        properties: {
            userId: {type: 'string', minLength: 1},
            scope: {type: 'string', minLength: 1},
            resourceId: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'permission.revoke');
    return ctx.services.permissionService.revoke({
        userId: args.userId,
        scope: args.scope,
        resourceId: args.resourceId,
    });
});

export const PERMISSION_TOOLS: McpTool[] = [permissionList, permissionGrant, permissionRevoke];
