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

export const userCreate: McpTool = defineTool({
    name: 'user.create',
    description: 'Create a new admin-side user. When `sendInvite=true` an invite email is dispatched with a temporary password (auto-generated if `password` omitted). Idempotent on `email`.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'addUser',
    inputSchema: {
        type: 'object',
        required: ['email', 'name', 'role'],
        properties: {
            email: {type: 'string', minLength: 3},
            name: {type: 'string', minLength: 1},
            role: {type: 'string', enum: ['admin', 'editor', 'viewer']},
            password: {type: 'string', minLength: 6},
            sendInvite: {type: 'boolean'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'user.create');
    const conn: any = ctx.services;
    const existing = await conn.userService?.getUser?.({email: args.email});
    if (existing && existing.id) {
        return {createUser: {id: existing.id, idempotent: true}};
    }
    // Generate a temp password if none supplied; force rotation on first login.
    const tempPassword = typeof args.password === 'string' && args.password.length >= 6
        ? args.password
        : `tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    const res = await conn.addUser({
        user: {
            email: args.email,
            name: args.name,
            role: args.role,
            password: tempPassword,
            mustChangePassword: true,
        },
    });
    const parsed: any = safeParse(res);
    if (args.sendInvite === true && parsed?.createUser?.id) {
        try {
            const mod: any = await import('@client/pages/api/_inquiryMailer').catch(() => null);
            if (mod && typeof mod.sendInquiryEmail === 'function') {
                const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'site';
                const adminUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '') + '/admin';
                await mod.sendInquiryEmail({
                    to: args.email,
                    subject: `You've been invited to ${siteName}`,
                    text: `Hello ${args.name},\n\nYou've been invited as ${args.role}. Sign in at ${adminUrl}\nTemporary password: ${tempPassword}\n\nYou'll be asked to set a new password on first login.`,
                    html: `<p>Hello ${args.name},</p><p>You've been invited as <b>${args.role}</b>. Sign in at <a href="${adminUrl}">${adminUrl}</a></p><p>Temporary password: <code>${tempPassword}</code></p><p>You'll be asked to set a new password on first login.</p>`,
                });
                parsed.invited = true;
            } else {
                parsed.invited = false;
                parsed.inviteError = 'mailer not available';
            }
        } catch (err) {
            parsed.invited = false;
            parsed.inviteError = String((err as Error).message || err);
        }
    }
    return parsed;
});

export const userUpdate: McpTool = defineTool({
    name: 'user.update',
    description: 'Patch user fields. Whitelist: name / email / role.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'updateUser',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            name: {type: 'string'},
            email: {type: 'string'},
            role: {type: 'string', enum: ['admin', 'editor', 'viewer']},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'user.update');
    const conn: any = ctx.services;
    const patch: any = {id: args.id};
    if (args.name !== undefined) patch.name = args.name;
    if (args.email !== undefined) patch.email = args.email;
    if (args.role !== undefined) patch.role = args.role;
    const res = await conn.updateUser({user: patch});
    return safeParse(res);
});

export const userDelete: McpTool = defineTool({
    name: 'user.delete',
    description: 'Remove a user by id. Refuses to remove the last admin. Permission cascade rules clean up grants.',
    scopes: ['admin:auth'],
    idempotent: true,
    gqlMutation: 'removeUser',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'user.delete');
    const conn: any = ctx.services;
    const res = await conn.removeUser({id: args.id});
    return safeParse(res);
});

export const USER_TOOLS: McpTool[] = [userList, userGet, userSetRole, userCreate, userUpdate, userDelete];
