/**
 * MCP stdio transport — entry point for `npm run mcp:stdio`.
 *
 * Spawned as a child process by Claude Code / Cursor / Continue. The whole
 * process IS the authenticated session: a single MCP token (`MCP_TOKEN` env
 * or `--token` flag) gates every call. The transport speaks MCP JSON-RPC
 * over stdin/stdout via the official SDK.
 *
 * To register with Claude Code / Cursor, see `tools/mcp.example.json`.
 */
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {McpServer} from '@services/features/Mcp/McpServer';
import type {IMcpToken} from '@interfaces/IMcp';

function readToken(): string | null {
    const envToken = process.env.MCP_TOKEN;
    if (envToken) return envToken;
    const flagIdx = process.argv.findIndex(a => a === '--token');
    if (flagIdx >= 0 && process.argv[flagIdx + 1]) return process.argv[flagIdx + 1];
    return null;
}

async function main() {
    const rawToken = readToken();
    if (!rawToken) {
        // stderr stays out of the protocol channel; stdout is reserved for JSON-RPC.
        process.stderr.write('[mcp:stdio] MCP_TOKEN is required (env or --token <secret>)\n');
        process.exit(2);
    }

    const conn = getMongoConnection();
    // Wait for setupClient() to finish — `mcpTokenService` is wired inside it.
    // Up to ~10s of retries — same budget as the Mongo connect timeout.
    let attempts = 0;
    while (!conn.mcpTokenService && attempts < 100) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (!conn.mcpTokenService) {
        process.stderr.write('[mcp:stdio] MongoDB not ready; aborting\n');
        process.exit(2);
    }

    const token: IMcpToken | null = await conn.mcpTokenService.verifyToken(rawToken);
    if (!token) {
        process.stderr.write('[mcp:stdio] token verification failed (expired / revoked / wrong)\n');
        process.exit(3);
    }
    void conn.mcpTokenService.markUsed(token.id);

    const mcp = new McpServer({services: conn, audit: conn.auditService});

    const server = new Server(
        {name: 'redis-node-js-cloud-cms', version: '0.1.0'},
        {capabilities: {tools: {}}},
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: mcp.listTools().map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const outcome = await mcp.dispatch({
            tool: req.params.name,
            args: req.params.arguments ?? {},
            token,
        });
        if (!outcome.ok) {
            return {
                isError: true,
                content: [{type: 'text', text: JSON.stringify(outcome.error)}],
            };
        }
        return outcome.result!;
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`[mcp:stdio] connected as ${token.name} (scopes: ${token.scopes.join(',')})\n`);
}

main().catch(err => {
    process.stderr.write(`[mcp:stdio] fatal: ${String((err as Error).stack || err)}\n`);
    process.exit(1);
});
