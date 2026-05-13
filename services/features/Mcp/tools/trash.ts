/**
 * F8 Week-2 — trash management (list / restore).
 *
 * Wraps the existing connection-level `getTrashGroups` and
 * `restoreFromTrash`. `trash.purge` (force-hard-delete a group) is
 * deferred to a follow-up — needs a new `cascadePurge` engine method
 * separate from the soft-delete TTL.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool, runBatch} from './_shared';
import {cascadePurge} from '@services/infra/cascadePurge';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

function safeParse(s: unknown): unknown {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

export const trashList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct read
    name: 'trash.list',
    description: 'Enumerate soft-deleted cohorts grouped by trashGroup. Each entry carries `deletedAt`, per-collection counts.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            limit: {type: 'integer', minimum: 1, maximum: 500},
            offset: {type: 'integer', minimum: 0},
        },
    },
}, async (args, ctx) => {
    const conn: any = ctx.services;
    const raw = await conn.getTrashGroups();
    const list = (safeParse(raw) as Array<unknown>) ?? [];
    const offset = typeof args.offset === 'number' ? args.offset : 0;
    const limit = typeof args.limit === 'number' ? args.limit : list.length;
    return list.slice(offset, offset + limit);
});

export const trashRestore: McpTool = defineTool({
    name: 'trash.restore',
    description: 'Restore one or many previously soft-deleted cohorts. Single form: pass {trashGroup}. Bulk form: pass {groups: string[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. Idempotent — re-running on a partially-restored group restores the survivors. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'restoreFromTrash',
    inputSchema: {
        type: 'object',
        properties: {
            trashGroup: {type: 'string', minLength: 1, description: 'Single-item form. Mutually exclusive with `groups`.'},
            groups: {type: 'array', items: {type: 'string', minLength: 1}, description: 'Bulk variant. Up to 500 groups. Mutually exclusive with `trashGroup`.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'trash.restore');
    const conn: any = ctx.services;
    const isBulk = Array.isArray(args.groups);
    const groups: string[] = isBulk
        ? args.groups.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
        : (typeof args.trashGroup === 'string' && args.trashGroup ? [args.trashGroup] : []);
    if (!groups.length) {
        throw new Error('trash.restore requires `trashGroup` or non-empty `groups[]`');
    }
    if (!isBulk) {
        const res = await conn.restoreFromTrash({trashGroup: groups[0], _session: {email: ctx.actor}});
        return safeParse(res);
    }
    return runBatch(groups.map(g => ({id: g})), async (id) => {
        const res = await conn.restoreFromTrash({trashGroup: id, _session: {email: ctx.actor}});
        return {result: safeParse(res)};
    });
});

export const trashPurge: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct cascadePurge engine
    name: 'trash.purge',
    description: 'IRREVERSIBLY hard-delete one or many trash groups. Single form: pass {trashGroup}. Bulk form: pass {groups: string[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. Cannot be restored. Admin-only, audited, idempotent. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    rateLimit: {maxPerMinute: 10},
    inputSchema: {
        type: 'object',
        properties: {
            trashGroup: {type: 'string', minLength: 1, description: 'Single-item form. Mutually exclusive with `groups`.'},
            groups: {type: 'array', items: {type: 'string', minLength: 1}, description: 'Bulk variant. Up to 500 groups. Mutually exclusive with `trashGroup`.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'trash.purge');
    const conn: any = getMongoConnection();
    const db = conn?.database;
    if (!db) throw new Error('Database not ready');
    const featureCtx = {
        db,
        redis: conn.cartRedis ?? null,
        services: conn.featureServices ?? {},
        reconnect: typeof conn.setupClient === 'function' ? conn.setupClient.bind(conn) : async () => {/* noop */},
    } as any;
    const isBulk = Array.isArray(args.groups);
    const groups: string[] = isBulk
        ? args.groups.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
        : (typeof args.trashGroup === 'string' && args.trashGroup ? [args.trashGroup] : []);
    if (!groups.length) {
        throw new Error('trash.purge requires `trashGroup` or non-empty `groups[]`');
    }
    if (!isBulk) {
        const res = await cascadePurge(groups[0], featureCtx);
        return {trashGroup: groups[0], ...res};
    }
    return runBatch(groups.map(g => ({id: g})), async (id) => {
        const res = await cascadePurge(id, featureCtx);
        return {result: res};
    });
});

export const TRASH_TOOLS: McpTool[] = [trashList, trashRestore, trashPurge];
