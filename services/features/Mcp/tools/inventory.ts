import {McpTool} from '../types';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});
const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return {raw: s}; } };

export const inventoryStatus: McpTool = {
    name: 'inventory.status',
    description: 'Returns the current inventory adapter status, last successful run, and last error.',
    scopes: ['read:inventory'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, ctx) => {
        const res = await ctx.services.inventoryStatus();
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const inventorySyncDelta: McpTool = {
    name: 'inventory.syncDelta',
    description: 'Triggers an inventory delta sync against the configured adapter.',
    scopes: ['write:inventory'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, ctx) => {
        const res = await ctx.services.inventorySyncDelta({_session: {kind: 'admin', role: 'admin', email: ctx.actor}});
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const inventoryReadDeadLetters: McpTool = {
    name: 'inventory.readDeadLetters',
    description: 'Returns the latest dead-letter rows (externalIds that failed 3 consecutive syncs).',
    scopes: ['read:inventory'],
    inputSchema: {
        type: 'object',
        properties: {limit: {type: 'integer', minimum: 1, maximum: 500}},
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.inventoryReadDeadLetters({limit: args?.limit});
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const INVENTORY_TOOLS: McpTool[] = [inventoryStatus, inventorySyncDelta, inventoryReadDeadLetters];
