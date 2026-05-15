/**
 * W6c — MCP tools for marketing attribution.
 *
 *   marketing.attribution.list — admin-rank read; aggregated report by
 *     source / campaign / ref over a relative time window.
 *
 * Reporting only — capture happens client-side via the public GraphQL
 * mutation `recordMarketingHit`. This tool is the AI-readable surface
 * for "what's converting?".
 */
import {McpTool} from '../types';
import {defineTool} from './_shared';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {MarketingAttributionService} from '@services/features/Marketing/MarketingAttributionService';

function svc(): MarketingAttributionService {
    const conn = getMongoConnection() as any;
    const s = conn.featureServices?.marketing as MarketingAttributionService | undefined;
    if (!s) throw new Error('MarketingAttributionService not available (marketing feature disabled?)');
    return s;
}

export const marketingAttributionList: McpTool = defineTool({
    // SAFE: read-only
    name: 'marketing.attribution.list',
    description: 'Aggregated marketing attribution report. Group by source / campaign / ref over a relative range (7d, 30d, 90d, all).',
    scopes: ['read:analytics'],
    auditScope: 'marketing',
    inputSchema: {
        type: 'object',
        properties: {
            groupBy: {type: 'string', enum: ['source', 'campaign', 'ref']},
            range: {type: 'string', description: 'Relative window — e.g. `7d`, `30d`, `90d`. Defaults to `30d`.'},
        },
    },
}, async (args) => {
    const groupBy = (args.groupBy === 'campaign' || args.groupBy === 'ref') ? args.groupBy : 'source';
    const range = typeof args.range === 'string' && args.range ? args.range : '30d';
    const report = await svc().report({groupBy: groupBy as any, range});
    return {groupBy, range, ...report};
});

export const MARKETING_TOOLS: McpTool[] = [
    marketingAttributionList,
];
