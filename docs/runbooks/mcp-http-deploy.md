# MCP HTTP transport — production deploy

Status: Active
Last updated: 2026-05-06

How to enable remote MCP access (Claude Desktop / Cursor / agent platforms) on a droplet running the standard `infra/compose.yaml` stack.

---

## What this gets you

- One additional service (`mcp`) on the back-end Docker network, running `npm run mcp:http`.
- One additional Caddy route — `https://${DOMAIN}/mcp` — proxying to `mcp:8788`, gated by an optional IP allowlist.
- **Two auth paths**:
  - **NextAuth session cookie** — if you're logged into `/admin/*` in the same browser, the MCP endpoint trusts the cookie and your CMS role drives capability. No token needed.
  - **Bearer token** — fallback for headless clients (Claude Desktop, Cursor, scripts). Same `McpTokens` UI at `/admin/system/mcp`.
- Per-identity rate limit + audit-friendly logs.

## Capability — role → scope mapping (cookie auth)

When the cookie path wins, the user's CMS role determines the MCP scope set:

| Role | Scopes granted | Effective access |
|---|---|---|
| `admin` | every `read:*`, `write:*`, `admin:auth`, `admin:bundle` | everything: edit content, themes, products, audit, lockout reset, full bundle export/import |
| `editor` | every `read:*` and `write:*` (no `admin:*`) | edit content/i18n/themes/products/inventory/site; cannot reset lockouts or import bundles |
| `viewer` | every `read:*` only | strictly read-only — listing pages, audit, analytics |

The `tools/list` response is **filtered** to the caller's allowed scopes — viewers never see write tools in the catalogue, editors never see `admin:*` tools. This is for UX clarity; the dispatcher gate enforces the same rule independently.

For bearer tokens, scopes are whatever was selected at issuance (capped by the issuing admin's role).

Architecture:

```
Claude Desktop / Cursor
        ↓ HTTPS, Authorization: Bearer mcpsk_…
   Caddy (TLS, optional IP allowlist on /mcp/*)
        ↓ HTTP, back-end network
   mcp service  (Express + StreamableHTTPServerTransport, port 8788)
        ↓
   MongoDB
```

---

## Required `.env` additions

Append to `/opt/cms/.env` on the droplet:

```bash
# Required to start the mcp service. Without this it exits cleanly
# (compose treats it as healthy-but-idle) — useful for sites that don't
# want remote MCP yet.
MCP_HTTP_ENABLED=true

# Defense in depth — bare minimum is leaving this empty (bearer-token
# only). Recommended is the CIDR of your office / VPN / tailnet.
# Comma-separated; CIDR or literal IPs.
MCP_ALLOWED_CIDR=198.51.100.0/24,203.0.113.7

# Optional second-line check enforced inside the mcp process. Empty =
# trust whatever Caddy let through. Set to the same CIDR as above for
# strictest setup.
MCP_HTTP_ALLOWED_IPS=

# Optional — tune the per-token rate limit. Default 600/min is fine
# for human-driven Claude Desktop; bump it for automation.
MCP_HTTP_RATE_LIMIT_PER_MIN=600
```

---

## Deploy

### Via the CI pipeline (recommended)

The `ci.yml` deploy job builds and restarts the `mcp` service automatically on every push to `master`. To stage a release on **one droplet first** (e.g. funisimo before skyclimber):

1. Actions → CI → Run workflow.
2. Pick `funisimo.pro` (or `skyclimber.pro`) from the `target` dropdown.
3. Run.

Empty `target` (the default on auto-trigger) deploys to every droplet in parallel.

### Manually on the droplet

```bash
cd /opt/cms
git pull
docker compose -f infra/compose.yaml up -d --build mcp caddy
```

`mcp` is built from the same `AppDockerfile` as the app — no separate image. `caddy` reloads to pick up the new `/mcp` route.

Verify:

```bash
docker compose -f infra/compose.yaml ps mcp
docker compose -f infra/compose.yaml logs mcp --tail 30
curl -i https://${DOMAIN}/mcp           # expects 401 — bearer missing
```

A 401 with `{"error":"missing bearer token"}` means the route is live and healthy.

If Caddy returns 403 instead, the IP allowlist matched but excluded you — adjust `MCP_ALLOWED_CIDR`.

---

## Browser-based use (cookie auth, no token needed)

For browser-based MCP clients (Claude Web, the MCP Inspector running in a tab, custom dashboards):

1. Log in at `https://${DOMAIN}/admin/*` like you normally would.
2. The same browser can now connect to `https://${DOMAIN}/mcp` directly — no token. The MCP endpoint reads your NextAuth session cookie and derives capability from your role.
3. Log out → MCP access revokes immediately.

This is the path to use when you want to *audit-trail* MCP actions to a real human user. Every call lands in the activity log under that admin's email rather than a shared service account.

## Issue a token (bearer auth, for headless clients)

Two paths:

**UI (recommended for human use):**
1. Visit `https://${DOMAIN}/admin/system/mcp`
2. Click "Issue token", give it a name (`alex-laptop`, `agent-prod`), pick scopes, set TTL.
3. Copy the secret on the reveal screen — shown ONCE, like a GitHub PAT.

**CLI (for bootstrap / scripts):**

```bash
docker compose exec app npm run mcp:dev-token -- --name alex-laptop --ttl 90
```

Same path, same DB row. The dev-token script defaults to all scopes; trim them in the UI if you want least-privilege.

---

## Wire Claude Desktop

Edit `~/AppData/Roaming/Claude/claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "redis-cms-prod": {
      "url": "https://your-domain.com/mcp",
      "headers": {
        "Authorization": "Bearer mcpsk_<paste-the-token>"
      }
    }
  }
}
```

Restart Claude Desktop. Logs land at `~/AppData/Roaming/Claude/logs/mcp-server-redis-cms-prod.log` (Windows) or `~/Library/Logs/Claude/mcp-server-redis-cms-prod.log` (macOS).

---

## Operational notes

**Sessions.** Each Claude Desktop instance opens one MCP session per server entry. The server keeps an in-memory map of `Mcp-Session-Id → transport`. Sessions go away on `DELETE /mcp` (clean shutdown), socket close, or process restart. Cold restart drops every session — clients reconnect transparently.

**Logs.** All MCP activity routes through the structured logger (`scope: mcp.http.*`, `scope: mcp.dispatch.*`). Tail with:

```bash
docker compose logs mcp -f --since 5m
```

**Revoke a token.** Hit the Revoke button at `/admin/system/mcp`. Effect is immediate — the next request from that token gets `401`. No restart needed.

**Rotate a token.** Issue a new one, update the client config, revoke the old one. The old token continues to work until you click revoke.

**Secret in transit.** TLS-only — Caddy redirects HTTP→HTTPS on the apex. The bearer is only as secure as the client device storing it; treat it like an SSH private key.

**Bundle.export / image.upload paths.** The `mcp` service mounts the same `uploads/` bind mounts as `app`, so file-touching tools land bytes where Next.js can serve them. If you split the volumes, those tools will silently land on the wrong filesystem.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `mcp` container exits cleanly with `MCP_HTTP_ENABLED is not "true"` | env var missing | Set `MCP_HTTP_ENABLED=true` in `.env`, `docker compose up -d mcp` |
| `401 auth required: NextAuth admin session cookie OR bearer token` | neither cookie nor bearer present | Log in at `/admin` (browser clients) or add the bearer (headless) |
| `401 invalid or revoked token` | revoked at `/admin/system/mcp`, expired, or typo | Issue a fresh token |
| `403 forbidden by IP allowlist` (Caddy) | `MCP_ALLOWED_CIDR` doesn't include your IP | Add your IP/CIDR, `docker compose up -d caddy` (no rebuild) |
| `403 forbidden by IP allowlist` (process) | `MCP_HTTP_ALLOWED_IPS` mismatch | Caddy passes `X-Forwarded-For`; the process uses Express `req.ip` (`trust proxy: loopback`). Set `MCP_HTTP_ALLOWED_IPS=` to disable the second check |
| `400 invalid or missing Mcp-Session-Id` | client sent a non-init request without a session | Restart the client; the SDK should re-init automatically |
| `429 rate limit exceeded` | > 600 calls/min per token | Bump `MCP_HTTP_RATE_LIMIT_PER_MIN` or split traffic across multiple tokens |
| Server-Sent Events stall mid-stream | Caddy buffering | Already disabled via `flush_interval -1` in the Caddyfile — confirm you're on the deployed config |

---

## Security review checklist

Before pointing real automation at this:

- [ ] `MCP_ALLOWED_CIDR` set to your specific CIDRs — don't ship with `0.0.0.0/0`.
- [ ] `https://${DOMAIN}/mcp` returns 401 (not 200) when curled without a bearer.
- [ ] Tokens have minimum-needed scopes (the UI lets you drop write scopes from a read-only token).
- [ ] Tokens have a TTL — the UI defaults to 90d. Don't issue immortal tokens.
- [ ] Mongo's public port is still closed (verify with `nmap -p 27017 ${DOMAIN}` from outside).
- [ ] Revocation tested at least once — issue, use, revoke, confirm 401.
