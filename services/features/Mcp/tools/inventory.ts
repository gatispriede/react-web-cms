import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';

const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return {raw: s}; } };

export const inventoryStatus: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'inventory.status',
    description: 'Returns the current inventory adapter status, last successful run, and last error.',
    scopes: ['read:inventory'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => {
    const res = await ctx.services.inventoryStatus();
    return typeof res === 'string' ? safeParse(res) : res;
});

/**
 * inventory.syncDelta — phase-1 caveat: layering MCP `withIdempotency`
 * on top of the inventory dead-letter retry loop is unsafe.
 *
 * The InventoryService keys its own retry/dead-letter state by
 * `externalId` (per-row); the MCP idempotency key is per-call (entire
 * sync). They live in separate namespaces, but caching an in-flight
 * sync's *envelope* would let a replay return "succeeded" while the
 * service-level dead-letter queue is still draining. Better to let the
 * service own retry semantics — `idempotent: false` here, with a
 * comment.
 */
export const inventorySyncDelta: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'inventory.syncDelta',
    description: 'Triggers an inventory delta sync against the configured adapter.',
    scopes: ['write:inventory'],
    idempotent: false,
    rateLimit: {maxPerMinute: 5},
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => {
    await enforceModeForTool(ctx.actor, 'inventory.syncDelta');
    const res = await ctx.services.inventorySyncDelta({_session: {kind: 'admin', role: 'admin', email: ctx.actor}});
    return typeof res === 'string' ? safeParse(res) : res;
});

export const inventoryReadDeadLetters: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'inventory.readDeadLetters',
    description: 'Returns the latest dead-letter rows (externalIds that failed 3 consecutive syncs).',
    scopes: ['read:inventory'],
    inputSchema: {
        type: 'object',
        properties: {limit: {type: 'integer', minimum: 1, maximum: 500}},
    },
}, async (args, ctx) => {
    const res = await ctx.services.inventoryReadDeadLetters({limit: args?.limit});
    return typeof res === 'string' ? safeParse(res) : res;
});

export const INVENTORY_TOOLS: McpTool[] = [inventoryStatus, inventorySyncDelta, inventoryReadDeadLetters];
