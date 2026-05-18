/**
 * MCP server bridge for the inline agent.
 *
 * Drives McpServer directly (in-process, no stdio round-trip) to expose the
 * full MCP tool surface to the agent loop. A synthetic IMcpToken with all
 * scopes is constructed per call — it is never stored in MongoDB and is never
 * bcrypt-verified. McpServer.dispatch() only checks `token.scopes.includes()`
 * for the scope gate; the bcrypt path lives in McpTokenService.verifyToken,
 * which is invoked by the stdio/HTTP transport layers, not here.
 */

import {McpServer}                    from '@services/features/Mcp/McpServer';
import {ALL_MCP_SCOPES}              from '@interfaces/IMcp';
import type {IMcpToken}              from '@interfaces/IMcp';
import type {ToolDefinition, ToolDispatch} from './agentTypes';

// ── Synthetic admin token ─────────────────────────────────────────────────────

/** Full-access token for in-process agent calls. Never persisted. */
const AGENT_TOKEN: IMcpToken = {
    id:            'agent-internal',
    name:          'cms-agent',
    tokenIdPrefix: '00000000',
    hashedSecret:  '',                          // never read by dispatch()
    scopes:        [...ALL_MCP_SCOPES],
    createdBy:     'system',
    createdAt:     new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mcpToToolDef(t: {name: string; description: string; inputSchema: unknown}): ToolDefinition {
    // Narrow at the call site — McpServer.listTools() declares
    // `inputSchema: unknown` because individual tool schemas vary, but
    // every tool we ship today follows the JSONSchema-object shape
    // below. Defaulting to an empty `properties` keeps the agent loop
    // crash-safe if a future tool ever ships without it.
    const schema = (t.inputSchema ?? {}) as {
        type?: 'object';
        required?: string[];
        properties?: Record<string, unknown>;
    };
    return {
        name:        t.name,
        description: t.description,
        input_schema: {
            type:       'object',
            properties: schema.properties ?? {},
            ...(schema.required?.length ? {required: schema.required} : {}),
        },
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns ToolDefinition[] for every tool registered in the MCP server.
 * The returned list is suitable for passing directly to runAgentLoop().
 *
 * @param services  MongoDBConnection facade — same object passed to makeCmsDispatch.
 */
export function getMcpToolDefinitions(services: any): ToolDefinition[] {
    const server = new McpServer({services});
    return server.listTools().map(mcpToToolDef);
}

/**
 * Returns a ToolDispatch that routes every call through McpServer.dispatch().
 * Returns the raw JSON string from content[0].text on success, or a
 * JSON { error: "..." } string on failure — matching the hand-coded dispatch
 * contract so agentLoop.ts needs no changes.
 *
 * @param services  MongoDBConnection facade.
 */
export function makeMcpDispatch(services: any): ToolDispatch {
    const server = new McpServer({services});

    return async (name: string, input: Record<string, unknown>): Promise<string> => {
        const outcome = await server.dispatch({
            tool:  name,
            args:  input,
            token: AGENT_TOKEN,
        });

        if (!outcome.ok) {
            const msg = outcome.error?.message ?? 'Tool call failed';
            return JSON.stringify({error: msg});
        }

        const first = outcome.result?.content?.[0];
        const text = first && 'text' in first ? first.text : undefined;
        return text ?? JSON.stringify({ok: true});
    };
}
