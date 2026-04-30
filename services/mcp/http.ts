/**
 * MCP HTTP/SSE transport — placeholder.
 *
 * v1 ships stdio only (see docs/features/mcp-server.md §11 / §10). HTTP/SSE
 * unlocks team / remote use but needs careful auth + rate-limiting that
 * isn't worth designing speculatively. The env switch (`MCP_HTTP_ENABLED`)
 * stays so ops can flip it on once we wire the real transport.
 *
 * DECISION: stub instead of skipping the file entirely so the package.json
 * `mcp:http` script doesn't 404 on a fresh checkout — the operator gets a
 * clear "not implemented in v1" message.
 */
const enabled = process.env.MCP_HTTP_ENABLED === 'true';

if (!enabled) {
    process.stderr.write('[mcp:http] MCP_HTTP_ENABLED is not "true"; HTTP/SSE transport is opt-in. Use `npm run mcp:stdio` for v1.\n');
    process.exit(0);
}

process.stderr.write('[mcp:http] HTTP/SSE transport is not implemented in v1. Use `npm run mcp:stdio`. See docs/features/mcp-server.md §10.\n');
process.exit(0);
