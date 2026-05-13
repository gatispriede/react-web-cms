/**
 * W8f — MCP tools for customer notifications.
 *
 *   notification.preferences.get  — read one user's prefs (admin-rank).
 *   notification.preferences.set  — patch one user's prefs (admin-rank).
 *   notification.stats            — admin observability: opt-in rates +
 *                                   24h send volume.
 *   notification.inbox.list       — admin support tool: see a customer's
 *                                   inbox rows (no PII beyond what's in
 *                                   the notification title/body).
 *
 * Bulk shape mirrors `user.setRole` — `items: [{userId, prefs}]` with
 * per-item failures captured via `runBatch` so a partial batch doesn't
 * abort the rest. See `_shared.ts` for the contract.
 */

import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool, runBatch} from './_shared';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {NOTIFICATION_CATEGORIES, NOTIFICATION_ROUTINGS, DIGEST_CADENCES} from '@interfaces/INotificationPreferences';
import type {NotificationsService} from '@services/features/Notifications/NotificationsService';

function svc(): NotificationsService {
    const conn = getMongoConnection();
    const s = (conn as any).featureServices?.notifications as NotificationsService | undefined;
    if (!s) throw new Error('NotificationsService not available (feature disabled?)');
    return s;
}

export const notificationPreferencesGet: McpTool = defineTool({
    // SAFE: read-only
    name: 'notification.preferences.get',
    description: 'Read one customer\'s notification preferences (merged with defaults). Identify by `userId` or `email`.',
    scopes: ['admin:auth'],
    auditScope: 'notifications',
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string'},
            email: {type: 'string'},
        },
    },
}, async (args) => {
    const n = svc();
    if (typeof args.email === 'string' && args.email) {
        const {userId, prefs} = await n.getPreferencesByEmail(args.email);
        return {userId, prefs};
    }
    if (typeof args.userId === 'string' && args.userId) {
        return {userId: args.userId, prefs: await n.getPreferences(args.userId)};
    }
    throw new Error('userId or email is required');
});

export const notificationPreferencesSet: McpTool = defineTool({
    name: 'notification.preferences.set',
    description: 'Patch one or many customers\' notification preferences. Single form: pass {userId, prefs}. Bulk form: pass {items: [{userId, prefs}]}. Mandatory categories (transactional) clamp to \'both\'. Returns merged prefs.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'notifications',
    inputSchema: {
        type: 'object',
        properties: {
            userId: {type: 'string', minLength: 1},
            prefs: {
                type: 'object',
                properties: {
                    byCategory: {
                        type: 'object',
                        additionalProperties: {type: 'string', enum: NOTIFICATION_ROUTINGS},
                    },
                    digestCadence: {type: 'string', enum: DIGEST_CADENCES},
                    quietHours: {
                        type: 'object',
                        properties: {
                            start: {type: 'string'},
                            end: {type: 'string'},
                            timezone: {type: 'string'},
                        },
                    },
                },
            },
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        userId: {type: 'string', minLength: 1},
                        prefs: {type: 'object'},
                    },
                },
                description: 'Bulk variant. Each item is {userId, prefs}.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'notification.preferences.set');
    const n = svc();
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: String(it?.userId ?? `idx:${i}`), payload: it}))
        : (typeof args.userId === 'string' && args.prefs ? [{id: args.userId, payload: args}] : []);
    if (!items.length) {
        throw new Error('notification.preferences.set requires `userId`+`prefs` or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (id, payload) => {
        const updated = await n.setPreferences(id, payload.prefs ?? {});
        return {prefs: updated};
    });
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.prefs : {ok: false, error: r.error};
    }
    return batch;
});

export const notificationStats: McpTool = defineTool({
    // SAFE: read-only aggregate
    name: 'notification.stats',
    description: 'Operator observability — per-category routing distribution across customers + 24h inbox volume. Use for "are people opting out of marketing?" type questions.',
    scopes: ['admin:auth'],
    auditScope: 'notifications',
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    return svc().aggregateStats();
});

export const notificationInboxList: McpTool = defineTool({
    // SAFE: read-only — admin support tool for "why didn't customer X see Y?"
    name: 'notification.inbox.list',
    description: 'List one customer\'s in-app inbox rows (admin support tool). Pass `userId` and optional `limit` (max 200) + `unreadOnly`.',
    scopes: ['admin:auth'],
    auditScope: 'notifications',
    inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
            userId: {type: 'string', minLength: 1},
            limit: {type: 'integer', minimum: 1, maximum: 200},
            unreadOnly: {type: 'boolean'},
        },
    },
}, async (args) => {
    const rows = await svc().listInbox({
        userId: args.userId,
        limit: typeof args.limit === 'number' ? args.limit : 50,
        unreadOnly: args.unreadOnly === true,
    });
    return {rows, count: rows.length};
});

// Sanity check: registry-time enum lookup so categories enum value used
// in JSON-schema descriptions is the same list the service uses.
void NOTIFICATION_CATEGORIES;

export const NOTIFICATION_TOOLS: McpTool[] = [
    notificationPreferencesGet,
    notificationPreferencesSet,
    notificationStats,
    notificationInboxList,
];
