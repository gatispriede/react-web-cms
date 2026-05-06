import {McpTool} from '../types';
import {defineTool} from './_shared';

/**
 * site.analyticsSummary — analytics summary for AI agents.
 * Per `docs/features/platform/client-analytics.md` (v2 2026-05-06).
 *
 * Returns the same shape the `/admin/release/analytics` dashboard reads:
 * KPIs (pageviews, events, unique visitors, sessions), daily time-series,
 * top pages/events/countries/referrers, and device/browser/OS breakdowns
 * — all scoped to one of the four audience segments.
 *
 * `audience` defaults to `public`, matching the dashboard. Pass `'all'`
 * to see the un-segmented data (handy for "is bot traffic up?" checks).
 */
export const analyticsSummary: McpTool = defineTool({
    name: 'site.analyticsSummary',
    description: 'Analytics summary — KPIs, daily time-series, top pages/events/countries, device/OS/browser breakdowns. Range: 24h | 7d | 30d. Audience: public (default) | admin | internal | bot | all.',
    scopes: ['read:analytics'],
    inputSchema: {
        type: 'object',
        properties: {
            range: {type: 'string', enum: ['24h', '7d', '30d'], description: 'Time window. Defaults to 7d.'},
            audience: {
                type: 'string',
                enum: ['public', 'admin', 'internal', 'bot', 'all'],
                description: 'Traffic segment. Defaults to public — excludes admin/internal/bot.',
            },
        },
    },
}, async (args, ctx) => {
    const range = args.range ?? '7d';
    const audience = args.audience ?? 'public';
    const svc = ctx.services?.analyticsService;
    if (!svc) return {error: 'analytics feature is disabled on this site'};
    return svc.summary(range as any, audience as any);
});

export const ANALYTICS_TOOLS: McpTool[] = [analyticsSummary];
