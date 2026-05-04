/**
 * In-process MCP dispatch runner — invoked by `tools/scripts/mcp-call.mjs`.
 *
 * Reads the call envelope from env vars (set by the parent .mjs), builds
 * the same `McpServer` the dev/runtime path uses, dispatches, and prints
 * the resulting envelope to stdout as JSON.
 *
 * Kept separate from `mcp-call.mjs` so the .mjs can stay dependency-free
 * Node and only spawn tsx when an actual call is being made.
 */
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {McpServer} from '@services/features/Mcp/McpServer';

async function main() {
    const tool = process.env.MCP_CALL_TOOL;
    const argsRaw = process.env.MCP_CALL_ARGS;
    const tokenRaw = process.env.MCP_CALL_TOKEN;
    if (!tool || !argsRaw || !tokenRaw) {
        console.error('[mcp-call-runner] missing env (tool/args/token)');
        process.exit(2);
    }
    const args = JSON.parse(argsRaw);
    const token = JSON.parse(tokenRaw);

    // The connection facade owns every service. Wait briefly for it to
    // finish its async setup (matches the pattern used by the page
    // handlers).
    const connection = getMongoConnection();
    for (let i = 0; i < 50 && !connection.userService; i++) {
        await new Promise((r) => setTimeout(r, 100));
    }
    if (!connection.userService) {
        console.error('[mcp-call-runner] Mongo not ready');
        process.exit(3);
    }

    const server = new McpServer({services: connection});
    const outcome = await server.dispatch({
        tool,
        args,
        token: {
            id: token.id,
            name: token.name,
            // The McpServer doesn't verify the secret — it trusts the
            // transport layer to have done that. For a local CLI call
            // we already trust the dev environment.
            scopes: token.scopes,
        } as any,
        tokenSecret: token.tokenSecret,
    });

    process.stdout.write(JSON.stringify(outcome, null, 2) + '\n');
    process.exit(outcome.ok ? 0 : 1);
}

main().catch((err) => {
    console.error('[mcp-call-runner] fatal', err);
    process.exit(1);
});
