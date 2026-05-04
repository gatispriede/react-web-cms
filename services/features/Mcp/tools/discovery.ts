/**
 * Discovery tools — `tool.list` and `tool.describe`. The self-describing
 * root for an MCP agent. Filtered by the actor's mode + advanced-only
 * allowlist so a simplified-mode user only sees tools they can actually
 * invoke. Sorted by category name then tool name for human-readable
 * output.
 */
import {McpTool} from '../types';
import {ADVANCED_ONLY_TOOLS} from '../ADVANCED_TOOLS';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool} from './_shared';

const MCP_TOKEN_PREFIX = 'mcp:';

async function actorMode(actor: string): Promise<'simplified' | 'advanced'> {
    if (!actor || actor.startsWith(MCP_TOKEN_PREFIX)) return 'advanced';
    try {
        const conn: any = getMongoConnection();
        const me = await conn?.userService?.getUser?.({email: actor});
        return me?.adminUiMode === 'simplified' ? 'simplified' : 'advanced';
    } catch {
        return 'advanced';
    }
}

function toMeta(t: McpTool) {
    return {
        name: t.name,
        description: t.description,
        scopes: t.scopes,
        idempotent: t.idempotent === true,
        auditScope: t.auditScope ?? t.name.split('.')[0],
        rateLimit: t.rateLimit ?? null,
        category: t.name.split('.')[0],
    };
}

export const toolList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'tool.list',
    description: 'List every MCP tool the caller can invoke. Filtered by admin UI mode (simplified-mode actors do not see advanced-only tools). Sorted by category.',
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        properties: {
            category: {type: 'string', description: 'Optional category filter (page, theme, image, etc.)'},
        },
    },
}, async (args, ctx) => {
    const {ALL_MCP_TOOLS} = await import('./index');
    const mode = await actorMode(ctx.actor);
    const filterCategory = typeof args.category === 'string' && args.category.length > 0
        ? args.category : null;
    const visible = ALL_MCP_TOOLS.filter(t => {
        if (mode === 'simplified' && ADVANCED_ONLY_TOOLS.has(t.name)) return false;
        if (filterCategory && t.name.split('.')[0] !== filterCategory) return false;
        return true;
    });
    const sorted = [...visible].sort((a, b) => {
        const ca = a.name.split('.')[0];
        const cb = b.name.split('.')[0];
        if (ca !== cb) return ca.localeCompare(cb);
        return a.name.localeCompare(b.name);
    });
    return {
        count: sorted.length,
        actorMode: mode,
        tools: sorted.map(toMeta),
    };
});

export const toolDescribe: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'tool.describe',
    description: 'Full input schema + flags for a single tool name.',
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        required: ['toolName'],
        properties: {
            toolName: {type: 'string', minLength: 1},
        },
    },
}, async (args) => {
    const {ALL_MCP_TOOLS} = await import('./index');
    const t = ALL_MCP_TOOLS.find(x => x.name === args.toolName);
    if (!t) return {ok: false, error: 'not found'};
    return {
        ok: true,
        ...toMeta(t),
        inputSchema: t.inputSchema,
        gqlMutation: (t as any).gqlMutation ?? null,
    };
});

export const DISCOVERY_TOOLS: McpTool[] = [toolList, toolDescribe];
