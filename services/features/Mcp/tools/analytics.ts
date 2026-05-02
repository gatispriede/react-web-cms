import {McpTool} from '../types';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

/**
 * site.analyticsSummary — canned analytics summary for AI agents.
 * Per `docs/features/platform/client-analytics.md` (decision 4 — canned only).
 *
 * Returns the same shape the `/admin/analytics` dashboard reads:
 * top pages + top events for the requested range. No arbitrary
 * aggregation surface; keeps the AI-callable surface auditable.
 */
export const analyticsSummary: McpTool = {
    name: 'site.analyticsSummary',
    description: 'Canned analytics summary — top pages + top events for the given range. Range: 24h | 7d | 30d. Useful for "is traffic dropping on /products this week?" style checks.',
    scopes: ['read:analytics'],
    inputSchema: {
        type: 'object',
        properties: {
            range: {type: 'string', enum: ['24h', '7d', '30d'], description: 'Time window. Defaults to 7d if omitted.'},
        },
    },
    handler: async (args, ctx) => {
        const range = args.range ?? '7d';
        const svc = ctx.services?.analyticsService;
        if (!svc) return ok({error: 'analytics feature is disabled on this site'});
        const raw = await svc.summary(range);
        try {
            return ok(JSON.parse(raw));
        } catch {
            return ok({error: 'analytics summary returned non-JSON'});
        }
    },
};

export const ANALYTICS_TOOLS: McpTool[] = [analyticsSummary];
