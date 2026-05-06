/**
 * MCP stdio transport — entry point for `npm run mcp:stdio`.
 *
 * Spawned as a child process by Claude Code / Cursor / Continue. The whole
 * process IS the authenticated session: a single MCP token (`MCP_TOKEN` env
 * or `--token` flag) gates every call. The transport speaks MCP JSON-RPC
 * over stdin/stdout via the official SDK.
 *
 * stdout discipline: ONLY JSON-RPC frames go to stdout. Any non-JSON line
 * (a stray `console.log`, an ANSI-coloured INFO log, npm's own banner)
 * is treated as malformed by the client and surfaces as `Unexpected token`
 * errors in `~/AppData/Roaming/Claude/logs/mcp-server-*.log`. Two
 * defenses live here:
 *   1. Set `MCP_STDIO=1` BEFORE any other import — the structured logger
 *      reads it at module load and routes every line to stderr.
 *   2. Hijack `console.*` in this same pre-import block so transitive
 *      modules that bypass the logger (vendored deps, drive-by debug
 *      logs, `[setup]` prints) also land on stderr.
 *
 * To register with Claude Code / Cursor, see `tools/mcp.example.json`.
 */

// CRITICAL: this block runs BEFORE every other import so it influences
// the logger's module-level `STDIO_ONLY_STDERR` constant and any
// console.log call made during early service-loader bootstrap.
process.env.MCP_STDIO = '1';
// Mute pretty-printed colour codes too — they'd still be valid stderr,
// but they make the Claude log file harder to read on the operator side.
process.env.LOG_FORMAT = process.env.LOG_FORMAT ?? 'json';
// Reroute the four console levels to stderr. Code that does
// `console.log('[setup] ...')` or vendored libs that print on import
// would otherwise corrupt the JSON-RPC stream.
{
    const sink = (...args: unknown[]) => {
        try {
            const line = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
            process.stderr.write(line + '\n');
        } catch { /* never let logging throw — silent drop is fine here */ }
    };
    console.log = sink;
    console.info = sink;
    console.warn = sink;
    console.debug = sink;
    // `console.error` already writes to stderr, but normalise so its
    // formatting matches the others.
    console.error = sink;
}

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
            // Tools that call back into the CMS over HTTP need the raw
            // bearer secret. The dispatcher threads it onto the tool
            // context; tools that don't read it never see it.
            tokenSecret: rawToken,
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
