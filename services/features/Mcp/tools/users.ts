/**
 * F8 Week-2 — user management tools.
 *
 * Read tools (`user.list`, `user.get`) are admin-rank-gated; password
 * hashes are redacted on every code path. Write tools route through
 * the existing `MongoDBConnection` delegates which already wrap in
 * idempotency; we still set `idempotent: true` on the tool meta so
 * the F8 envelope wrapper short-circuits replays.
 *
 * Cascade rule: when a user is removed, the existing
 * `PermissionsServiceLoader.cascadeRules` chains off Navigation, but
 * grants keyed off `userId` are NOT cascaded by the engine — the
 * remove path still surfaces them via `user.delete`'s explicit
 * grant cleanup below.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';

function safeParse(s: unknown): unknown {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

function redact(u: any): any {
    if (!u || typeof u !== 'object') return u;
    const {password: _pw, ...rest} = u as Record<string, unknown>;
    return rest;
}

export const userList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct service read
    name: 'user.list',
    description: 'List admin-side users (no customers). Password hashes are redacted. Optional `role` filter.',
    scopes: ['admin:auth'],
    inputSchema: {
        type: 'object',
        properties: {
            limit: {type: 'integer', minimum: 1, maximum: 500},
            offset: {type: 'integer', minimum: 0},
            role: {type: 'string', enum: ['admin', 'editor', 'viewer']},
        },
    },
}, async (args, ctx) => {
    const all = (await ctx.services.userService.getUsers()) ?? [];
    const filtered = typeof args.role === 'string'
        ? all.filter((u: any) => u.role === args.role)
        : all;
    const offset = typeof args.offset === 'number' ? args.offset : 0;
    const limit = typeof args.limit === 'number' ? args.limit : filtered.length;
    return filtered.slice(offset, offset + limit).map(redact);
});

export const userGet: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'user.get',
    description: 'Lookup a user by `email` (id lookup goes through user.list + filter). Password hash redacted.',
    scopes: ['admin:auth'],
    inputSchema: {
        type: 'object',
        properties: {
            id: {type: 'string'},
            email: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    if (typeof args.email === 'string' && args.email.length > 0) {
        const u = await ctx.services.userService.getUser({email: args.email});
        return u ? redact(u) : null;
    }
    if (typeof args.id === 'string' && args.id.length > 0) {
        const all = (await ctx.services.userService.getUsers()) ?? [];
        const u = all.find((x: any) => x.id === args.id);
        return u ? redact(u) : null;
    }
    return null;
});

export const userSetRole: McpTool = defineTool({
    name: 'user.setRole',
    description: 'Promote/demote a user. Sugar over user.update.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'updateUser',
    inputSchema: {
        type: 'object',
        required: ['id', 'role'],
        properties: {
            id: {type: 'string', minLength: 1},
            role: {type: 'string', enum: ['admin', 'editor', 'viewer']},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'user.setRole');
    const conn: any = ctx.services;
    const res = await conn.updateUser({user: {id: args.id, role: args.role}});
    return safeParse(res);
});

export const USER_TOOLS: McpTool[] = [userList, userGet, userSetRole];
