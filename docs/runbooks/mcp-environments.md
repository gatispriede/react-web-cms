# MCP environments — which server is which

> Recurring source of confusion in agent sessions. Names don't follow a
> single convention; this doc is the source of truth.

## Servers in active use

| Tool prefix in Claude | Targets | Mongo | Notes |
|------|---------|-------|-------|
| `mcp__funisimo-prod__*` | **PRODUCTION** funisimo.pro CMS | Prod Mongo on the funisimo droplet | Treat every write as production. Reads are safe. |
| `mcp__redis-cloud-mcp__*` | **LOCAL DEV** CMS on this machine | `mongodb://localhost:27017/DB` | Despite the `redis-cloud` name (legacy — the repo was once called that), this points at the LOCAL dev instance. Writes hit local Mongo only. |

**Both servers ship the same tool set** (page.*, section.*, module.*,
product.*, theme.*, etc.) — only the backing Mongo differs.

## How to tell them apart in a session

1. **Check the prefix on `mcp__…__*` tool names** — that's the only
   reliable signal. The `funisimo-prod` prefix means production; the
   `redis-cloud-mcp` prefix means local dev.
2. **Cross-check with a read**: `page_list` on prod returns
   `cv-nav-home` / `cv-nav-contact` / `cv-nav-cms` / `cv-nav-lss` (the
   live portfolio nav, with `editedBy: gatiss.priede@gmail.com` on
   recent rows). Local will either match (if you imported the prod
   bundle) or be a different seed.

## Common failure modes

- **"Local MCP disconnected"** — the `redis-cloud-mcp` server (local)
  sometimes drops mid-session. Symptom: ToolSearch for its prefix
  returns `No matching deferred tools found`. Reconnect: restart the
  MCP server process, or re-issue the local MCP token via Settings →
  MCP if it expired. See `docs/SETUP.md` §9 for the registration shape.

- **"All MCP tools look like prod"** — only `mcp__funisimo-prod__*` is
  visible. The local server is disconnected. Don't substitute prod
  writes for local; reconnect the local server instead.

- **"User says 'use local MCP' but I only see prod tools"** — do not
  fire writes. Ask the user to reconnect the local server. Direct
  GraphQL against `http://localhost/api/graphql` is the fallback if
  the local MCP can't be brought back, but it needs an admin auth
  cookie and bypasses MCP's audit trail.

## Registration reference

`~/.claude/mcp.json` shape — taken from `docs/SETUP.md` §9.2:

```json
{
  "mcpServers": {
    "redis-cloud-mcp": {
      "command": "npm",
      "args": ["run", "mcp:stdio"],
      "cwd": "/absolute/path/to/redis-node-js-cloud",
      "env": {
        "MCP_TOKEN": "mcpsk_<local-token>",
        "MONGODB_URI": "mongodb://localhost:27017/DB"
      }
    },
    "funisimo-prod": {
      "command": "...",
      "env": {
        "MCP_TOKEN": "mcpsk_<prod-token>",
        "MONGODB_URI": "<prod-connection-string>"
      }
    }
  }
}
```

## Renaming the local server (recommended)

The `redis-cloud-mcp` name is misleading. When convenient, rename the
local entry in `~/.claude/mcp.json` from `redis-cloud-mcp` to
`funisimo-local`. After a Claude restart, tools surface as
`mcp__funisimo-local__*` — matches the `funisimo-prod` convention and
removes the source of confusion. Update this doc + `SETUP.md` §9 in
the same pass.
