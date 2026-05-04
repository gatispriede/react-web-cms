/**
 * Diagnostics + observability MCP tools — health snapshot, cache
 * version bumping, error-log tail. All wrap existing service surfaces;
 * no new service methods.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {bumpFeatureVersions} from '@services/infra/cacheVersion';
import {defineTool} from './_shared';

export const diagnosticsHealth: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'diagnostics.health',
    description: 'F5 admin diagnostics snapshot — DB, redis, idempotency, feature flags, MCP coverage.',
    scopes: ['read:audit'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    const conn: any = getMongoConnection();
    const raw = await conn.getDiagnostics();
    let snapshot: any = {};
    try { snapshot = JSON.parse(typeof raw === 'string' ? raw : '{}'); } catch { snapshot = {raw}; }
    // Lazy-import to avoid the diagnostics tool ↔ tool registry cycle.
    const {ALL_MCP_TOOLS} = await import('./index');
    const categories = new Map<string, number>();
    for (const t of ALL_MCP_TOOLS) {
        const cat = t.name.split('.')[0];
        categories.set(cat, (categories.get(cat) ?? 0) + 1);
    }
    snapshot.mcpCoverage = {
        toolCount: ALL_MCP_TOOLS.length,
        categories: Object.fromEntries([...categories.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    };
    return snapshot;
});

export const cacheBumpVersion: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'cache.bumpVersion',
    description: 'Force-invalidate a feature cache by bumping its cache-version key. Pass a single feature id.',
    scopes: ['write:site'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['feature'],
        properties: {
            feature: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'cache.bumpVersion');
    const map = await bumpFeatureVersions([args.feature]);
    return {feature: args.feature, version: map[args.feature] ?? null};
});

export const logTail: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'log.tail',
    description: 'Recent error-log entries from ErrorLogService. Filter by scope, since (ISO-8601), and limit.',
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        properties: {
            scope: {type: 'string'},
            since: {type: 'string'},
            limit: {type: 'integer', minimum: 1, maximum: 500},
        },
    },
}, async (args) => {
    const conn: any = getMongoConnection();
    const svc = conn?.errorLogService;
    if (!svc) return {rows: [], error: 'errorLogService unavailable'};
    const rows = await svc.list({
        scope: typeof args.scope === 'string' ? args.scope : undefined,
        sinceISO: typeof args.since === 'string' ? args.since : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 100,
    });
    return {rows};
});

export const DIAGNOSTICS_TOOLS: McpTool[] = [diagnosticsHealth, cacheBumpVersion, logTail];
