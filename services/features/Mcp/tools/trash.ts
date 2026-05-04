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
import {defineTool} from './_shared';

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
    description: 'Restore a previously soft-deleted cohort. Idempotent — re-running on a partially-restored group restores the survivors.',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'restoreFromTrash',
    inputSchema: {
        type: 'object',
        required: ['trashGroup'],
        properties: {
            trashGroup: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'trash.restore');
    const conn: any = ctx.services;
    const res = await conn.restoreFromTrash({
        trashGroup: args.trashGroup,
        _session: {email: ctx.actor},
    });
    return safeParse(res);
});

export const TRASH_TOOLS: McpTool[] = [trashList, trashRestore];
