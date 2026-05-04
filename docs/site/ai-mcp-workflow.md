# AI / MCP workflow

The CMS ships an MCP (Model Context Protocol) server. An LLM connected to it can author entire pages — modules, copy, themes, translations — through natural language. This is the core differentiator: the cost of a new page is a prompt, not a developer.

## Connecting an MCP client

1. Open **Admin → System → MCP tokens** and click **Issue token**. Choose a label and an expiry.
2. Copy the token (shown once).
3. In your MCP-capable client (Claude Desktop, Cursor, an SDK script, etc.) register a server entry pointing to:

```
https://<your-site>/api/mcp
Authorization: Bearer <token>
```

Tokens carry the issuing user's rank and grants — the LLM cannot perform actions the human couldn't.

## What the LLM can do

The MCP surface mirrors the admin. Representative tools:

- `cms.listPages`, `cms.createPage`, `cms.deletePage`
- `cms.addModule(pageId, type, content)` — drops a module into a page; `content` is a small JSON shape per module type.
- `cms.setTheme(themeId)`, `cms.createTheme(tokens)` — themes are just colour + typography token bags.
- `cms.translate(symbol, key, value)` — write into the translations table for a language.
- `cms.upsertPost`, `cms.publishPost`.
- `analytics.summary`, `errors.recent`, `users.list` — read-only introspection.

Each tool is gated by the same authz layer as the equivalent UI path. A token issued to an `editor` cannot create users; one issued to a user in **simplified mode** cannot reach advanced tools.

## Authoring loop

A typical prompt:

> "Add a 3-section landing page at /pricing. Hero with headline 'Pick your plan', then a 3-column ProjectCard grid for Starter / Pro / Agency with prices 19/49/199 and short feature lists, then an InquiryForm at the bottom. Use the current theme."

The LLM:

1. Calls `cms.createPage({page: 'Pricing'})`.
2. Adds three sections with `cms.addModule` — Hero, three ProjectCards inside one section, InquiryForm.
3. Optionally calls `cms.translate` to seed copy in other enabled languages.

Result: a working page in seconds, fully editable in the admin afterwards.

## Guardrails

- All MCP mutations go through the same content schema validators as the UI (see `shared/utils/contentSchemas.ts`). Malformed shapes are rejected before they hit Mongo.
- Every mutation is audit-logged with the issuing token id. Revoke from the MCP tokens pane to cut access immediately.
- The MCP server respects feature flags. A disabled feature's tools 404.
