import {McpTool} from '../types';

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

export const AUDIT_TOOLS: McpTool[] = [auditList];
