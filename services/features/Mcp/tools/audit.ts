import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

export const auditList: McpTool = {
    name: 'audit.list',
    description: 'Reads the audit log with optional filters (actorEmail, collection, docId, op, since, until).',
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        properties: {
            actorEmail: {type: 'string'},
            collection: {type: 'string'},
            docId: {type: 'string'},
            op: {type: 'string', enum: ['create', 'update', 'delete']},
            since: {type: 'string', description: 'ISO date'},
            until: {type: 'string', description: 'ISO date'},
            limit: {type: 'integer', minimum: 1, maximum: 500},
            offset: {type: 'integer', minimum: 0},
        },
    },
    handler: async (args, ctx) => {
        const since = args.since ? new Date(args.since) : undefined;
        const until = args.until ? new Date(args.until) : undefined;
        if (!ctx.audit) return ok({rows: [], total: 0});
        const {rows, total} = await ctx.audit.list({
            actorEmail: args.actorEmail,
            collection: args.collection,
            docId: args.docId,
            op: args.op,
            since,
            until,
            limit: args.limit,
            offset: args.offset,
        });
        return ok({rows, total});
    },
};

/**
 * audit.errors — query the recent ErrorLog collection. Mirrors the
 * `/admin/release/errors` admin page so an AI client can grep its own
 * recent failures without opening a browser. TTL on the collection
 * (30 days) bounds the search space.
 */
export const auditErrors: McpTool = {
    name: 'audit.errors',
    description: 'Query the structured error log. Filter by source (client/admin/server/mcp), level (error/warn), scope, or since-date. Defaults to the latest 50 entries.',
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        properties: {
            source: {type: 'string', enum: ['client', 'admin', 'server', 'mcp']},
            level: {type: 'string', enum: ['error', 'warn']},
            scope: {type: 'string'},
            since: {type: 'string', description: 'ISO date'},
            limit: {type: 'integer', minimum: 1, maximum: 500},
        },
    },
    handler: async (args, _ctx) => {
        const mongo = getMongoConnection();
        if (!mongo?.errorLogService) return ok({rows: [], total: 0});
        const rows = await mongo.errorLogService.list({
            source: args.source,
            level: args.level,
            scope: args.scope,
            sinceISO: args.since,
            limit: args.limit ?? 50,
        });
        return ok({rows, total: rows.length});
    },
};

export const AUDIT_TOOLS: McpTool[] = [auditList, auditErrors];
