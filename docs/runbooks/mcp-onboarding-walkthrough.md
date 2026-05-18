# MCP onboarding walkthrough

End-to-end operator + agent walkthrough showing how to drive the CMS
through MCP without ever touching the admin UI. Every step shows the
exact tool call (JSON request/response) + expected outcome.

This is the F8 acceptance gate target — an LLM agent (or a customer
integration) can stand a site up from zero through these 10 steps.

Reference: [mcp-real-world-ready](../roadmap/platform/mcp-real-world-ready.md).

## Prerequisites

- An admin account on the target CMS install.
- HTTP transport URL (POST `/api/mcp` — the in-process registry the test
  suite uses; production deploys an SSE/stdio variant).

## 1. Issue an MCP token (admin UI step)

Navigate to `/admin/system/tokens` (or the equivalent in your build).
Pick a name (`onboarding-bot`), select the scopes the agent needs
(typically `read:content`, `write:content`, `read:i18n`, `write:i18n`,
`read:themes`, `write:themes`, `read:site`, `write:site`, `read:audit`,
`admin:auth`). Copy the bearer secret on issue — it is only shown once.

This is the only step that is not automatable through MCP. Token
issuance must be done by a human admin.

## 2. Discover available tools

```json
// Request
{"tool": "tool.list", "args": {}}
// Response
{"ok": true, "data": {"count": 87, "actorMode": "advanced", "tools": [
  {"name": "audit.errors", "category": "audit", ...},
  {"name": "page.create", "category": "page", "idempotent": true, ...},
  ...
]}}
```

Filter by category for a focused view:

```json
{"tool": "tool.list", "args": {"category": "page"}}
```

For a single tool's full schema:

```json
{"tool": "tool.describe", "args": {"toolName": "page.create"}}
```

## 3. Create a new page

```json
{"tool": "page.create", "args": {
  "page": "Pricing", "parent": null,
  "idempotencyKey": "create-pricing-2026-05-04"
}}
```

Outcome: a `Navigation` row + an empty `Sections` row are created. Use
`page.list` to confirm.

## 4. Add modules to the page

First list types:

```json
{"tool": "module.listTypes", "args": {}}
```

Then add a hero plus a CTA:

```json
{"tool": "module.add", "args": {
  "page": "Pricing", "moduleType": 1,
  "data": {"title": "Pricing", "subtitle": "Plans for every team"},
  "idempotencyKey": "pricing-hero-1"
}}
```

## 5. Set the active theme

```json
{"tool": "theme.list", "args": {}}
{"tool": "theme.setActive", "args": {"id": "<theme-id>",
  "idempotencyKey": "set-theme-2026-05-04"}}
```

## 6. Update the logo

```json
{"tool": "logo.update", "args": {
  "content": "<svg ...></svg>",
  "idempotencyKey": "logo-2026-05-04"
}}
```

Or upload an image first then point the logo at it:

```json
{"tool": "image.upload", "args": {
  "filename": "logo.svg", "contentBase64": "<base64>",
  "contentType": "image/svg+xml",
  "idempotencyKey": "logo-asset-2026-05-04"
}}
```

## 7. Update SEO

```json
{"tool": "seo.update", "args": {
  "global": {"title": "Acme — every team", "description": "..."},
  "idempotencyKey": "seo-2026-05-04"
}}
```

## 8. Publish

```json
{"tool": "site.publish", "args": {
  "channel": "production",
  "idempotencyKey": "publish-2026-05-04T10:00"
}}
```

## 9. Verify health

```json
{"tool": "diagnostics.health", "args": {}}
```

The response includes a `mcpCoverage` block showing the live tool
inventory by category — useful to assert the agent has parity coverage.

## 10. Roll back if a delete went wrong

```json
{"tool": "trash.list", "args": {}}
{"tool": "trash.restore", "args": {
  "trashGroup": "<id-from-list>",
  "idempotencyKey": "restore-2026-05-04"
}}
```

For irreversible cleanup (after confirming no more recovery is needed):

```json
{"tool": "trash.purge", "args": {
  "trashGroup": "<id>",
  "idempotencyKey": "purge-2026-05-04"
}}
```

## Notes

- Every destructive call accepts an `idempotencyKey`. Reuse the same key
  on retries — the response is replayed, not re-executed.
- Rate limits: 30/min for write tools, 100/min for reads. Refunds and
  trash purges are tighter (10/min). The envelope sets `retryAfterMs`
  on `RATE_LIMITED` errors.
- Simplified-mode admin users get a filtered `tool.list` — destructive
  operations are hidden. Use `actor.adminUiMode = 'advanced'` for full
  parity.
