# F8 — MCP coverage to real-world-ready

## Goal

Every CMS operation an admin can do through the UI has a corresponding MCP tool of equal capability and equal guards. Every destructive tool is idempotent, audited, mode-gated, rate-limited. Discovery + introspection are first-class. By the end, an LLM agent (or a customer's headless integration) can operate a production site end-to-end without ever touching the admin UI.

Per [user feedback from project memory](../../../.claude/projects/D--Work-redis-node-js-cloud/memory/MEMORY.md): MCP is the value proposition — natural language → ready pages with modules + themes; $99–$999/mo positioning depends on it. Reading the room: **the admin UI is the redundant surface long-term**; MCP is canonical.

Out of scope for v1: full admin-UI-as-thin-MCP-client refactor (separate generational rewrite). v1 is parity + production hardening.

## Why now

- Agent-driven onboarding (the docs site's "describe your site, get a draft" flow) needs every operation as a tool, not a click.
- Customer integrations (Stripe webhooks adjusting inventory, LLM moderation on inquiries, Zapier-style automation) work through MCP, not the admin UI.
- The current 38 tools cover ~60% of admin operations; gaps mean an LLM stops mid-flow because it can't move a page or reset a permission. Manual fallback breaks the value prop.

## Current state — 38 tools shipped

| Surface | Existing | Status |
|---|---|---|
| Page/Section | `page.{list,get,create}`, `section.{update,delete}` | partial — no update/delete/setParent for pages |
| Modules | `module.{listTypes,add,update,remove}` | shipping in F8 prep batch |
| Posts | `post.{list,get,upsert,delete}` | OK |
| Products | `product.{list,get,create,update,publish}` | OK; no delete |
| Inventory | `inventory.{status,readDeadLetters,syncDelta}` | OK |
| Themes | `theme.{list,update,setActive}` | no create/delete |
| Bundles | `bundle.{export,import}` | OK |
| Images | `image.list` | no upload/delete |
| Translations | `i18n.{listLanguages,upsertKeys}` | no language CRUD; no per-key delete |
| Site | `site.{publish,revalidate,setLayoutMode,featureFlags,setFeatureFlag,clearFeatureFlag,getPublishHistory,analyticsSummary,regenerateSchema}` | OK |
| Audit/Auth | `audit.{list,errors}`, `auth.resetLockouts` | OK |
| Inquiries / email | `inquiry.{list,delete,markRead}`, `email.send` | shipping in F8 prep batch |

## Gap map (priority order)

### P0 — page lifecycle (blocks most agent flows)

- `page.update` — rename, change parent, change slug. Wraps existing `addUpdateNavigationItem` + `setParent`.
- `page.delete` — wraps F2 `cascadeDelete`. Returns the resulting `trashGroup` so the caller knows what to restore if the wrong page was deleted.
- `page.setParent` — F1 setParent mutation directly. Cycle + 3-level cap enforced.
- `page.reorder` — set the order of pages within a parent (or root).

### P1 — user / permissions

- `user.{list,get,create,update,delete}`. `delete` cascades the user's session + grants via F2.
- `user.setRole` — rank role (admin / editor / viewer).
- `user.resetPassword` — sends reset email; doesn't expose password.
- `permission.{list,grant,revoke}` — F2 resource grants (feature/page/locale).
- `functionalRole.{list,assign,unassign}` — content-editor / translator / page-owner roles.

### P1 — languages / translations

- `language.{add,remove,setDefault}` — wraps `addUpdateLanguage` / `deleteLanguage`. Triggers the existing i18n grant migration.
- `translation.{set,delete}` — per-key ops. Today only bulk `i18n.upsertKeys`.
- `translation.suggest` (deferred) — LLM-side; no server tool needed.

### P1 — site-wide content

- `footer.{get,update}` — direct on the SiteSettings doc.
- `logo.{get,update}` — same.
- `seo.{get,update}` — both `SiteSeo` (per-page) and `SiteFlags` (site-wide).
- `siteFlags.update` — already partial via `site.setFeatureFlag`; add a higher-level update.

### P1 — cascade / trash

- `trash.list` — current trash groups across all `*.trash` collections.
- `trash.restore` — by `trashGroup` (F2 `cascadeRestore`).
- `trash.purge` — force-delete a trash group (admin-only, irreversible).

### P2 — themes + images

- `theme.{create,delete,resetPreset}` — wraps existing service surface.
- `image.{upload,delete,rescan}` — upload via base64 or URL fetch; delete with confirmation; `rescan` wraps `/api/rescan-images`.

### P2 — orders + diagnostics + observability

- `order.{list,get,markFulfilled,refund}` — currently out-of-scope; bring in.
- `diagnostics.health` — wraps F5 public endpoint with admin-only fields included.
- `cache.bumpVersion` — force-invalidate a feature's cache.
- `log.tail` — recent error-log entries filtered by scope.

### P2 — discovery

- `tool.list` — every registered tool name + description + input schema. Self-describing root.
- `tool.describe` — detailed schema for one tool.

## Cross-cutting hardening (every tool gets these)

**Week 1 status — wrappers shipped (`services/features/Mcp/tools/_shared.ts`).** Phase-2 sweep wires the 38 existing tools onto `compose(...)`. Composition order, outermost → innermost: **rate-limit → idempotency → audit → error-envelope → handler.**

1. **Idempotency — `withIdempotency(handler, {toolName, enabled})`.** Reads `args.idempotencyKey`; when present + `enabled`, routes via `getIdempotencyService().checkOrRun('mcp:<tool>:<key>', …)`. Replays inside the TTL return the cached envelope. Tool opts in by setting `idempotent: true` on the registry entry (now a typed field on `McpTool`). Destructive tools without it log a startup warning until swept.
2. **Mode-gate — `enforceModeForTool(actor, name)`.** Pre-existing helper; tools call it inline at the top of the handler. Routes a `FeatureRestrictedError` → `MODE_RESTRICTED` envelope code via `withErrorEnvelope`.
3. **Audit-on-call — `withAudit(handler, {toolName, auditScope})`.** Records on success AND failure via `ctx.audit.record({collection: 'McpToolCall', ...})`. Args are redacted via `redactSensitive` before persistence. `auditScope` defaults to the tool name's first dot-segment (`page.delete` → `page`).
4. **Rate limit — `withRateLimit(handler, {toolName, maxPerMinute})`.** Reuses `ui/client/pages/api/_rateLimit.ts` with bucket key `mcp:<tool>:<actor>`. Defaults: 100/min for read scopes, 30/min for write scopes (`defaultRateLimit(tool)`). Tool can override via `rateLimit: {maxPerMinute}`. Throws `RateLimitError` → `RATE_LIMITED` envelope with `retryAfterMs`.
5. **Error envelope — `withErrorEnvelope(handler, {toolName})`.** Always returns `{ok: true, data} | {ok: false, error: {code, message, hint?, retryAfterMs?}}`. Known mappings: `RateLimitError` → `RATE_LIMITED`, `IdempotencyConflictError` → `IDEMPOTENCY_CONFLICT`, `FeatureRestrictedError` → `MODE_RESTRICTED`, `McpError` → its `code`, anything else → `INTERNAL` (with stack logged via injected `logUnknown`). The `compose(...)` body JSON-serialises the envelope into `result.content[0].text` so existing dispatchers stay unchanged.
6. **Schema validation drift detection — `tools/scripts/mcp-schema-drift.mjs`** (`npm run lint:mcp-schema`). Walks every `services/features/Mcp/tools/*.ts` for `inputSchema.properties`; walks every `*ServiceLoader.ts` for `extend type MutationMongo { … }`; compares the property/arg lists for tools whose name maps to a same-named mutation (`page.update` ↔ `updatePage` / `pageUpdate`). Hard drift fails the script (extra/missing args, type mismatch); ambiguous matches and unmapped tools surface as soft warnings. Current state: 0 hard drift, 41 soft warnings (most tools route through service methods rather than top-level mutations — phase 2 will add explicit `gqlMutation: 'updatePage'` mapping hints).
7. **Streaming progress** — `bundle.import`, `image.upload` (large), `site.regenerateSchema` are multi-second. Add streaming progress events to the MCP transport so the agent sees `[42% imported]` not just a 30s wait. (Deferred to week 3.)

## Files to touch

Per surface a new file under `services/features/Mcp/tools/`. Plus shared helpers:
- `services/features/Mcp/tools/_shared.ts` — common error envelope, idempotency wrapper, audit wrapper, rate-limit wrapper.
- `services/features/Mcp/tools/index.ts` — register new tools.
- `services/features/Mcp/types.ts` — extend `McpTool` with required `idempotent: boolean` flag (true for all destructive).
- `tools/scripts/mcp-schema-drift.mjs` (new CI script) — drift detection.

## Acceptance

- `tool.list` returns ≥ 70 tools (38 today + ~32 new).
- An LLM agent walks the [docs/runbooks/mcp-onboarding-walkthrough.md](../../runbooks/mcp-onboarding-walkthrough.md) (new) — create site, add pages, set theme, upload logo, add inquiry form, publish — without any UI clicks. End-to-end test in CI.
- 0 destructive tools bypass `enforceModeForTool` + idempotencyKey + audit (CI check).
- Bundle round-trip via `bundle.export` → `bundle.import` produces zero diff (already tested; F8 doesn't regress).
- Rate limit responds 429 with `Retry-After` when exceeded (test).
- Schema drift CI fails when a developer adds a GraphQL arg without bumping the MCP tool schema.

## Risks / notes

- **Surface growth makes audit + rate-limit + error-envelope sweeps the long tail.** Each new tool needs all 5 cross-cutting concerns; budgeting individual tool implementation is misleading. Build the wrappers first, then per-tool work is just business logic.
- **Bundle export/import + cascade engine + idempotency** are F2 primitives — F8 leans on them. Validate they hold under the full-load MCP-driven flow (not just the per-mutation tests).
- **Permission tools expose the system's own auth surface.** A bug in `permission.grant` could silently grant admin to a malicious caller. Test rigorously; require `mode: 'advanced'` always; require `actor.rank === 'admin'` always.
- **Streaming progress** requires changes to the MCP transport (currently request/response). Confirm the SDK supports server-sent events or chunked transfer; flag if it doesn't and we need to upgrade the transport layer.

## Effort

**XL · 2–3 weeks.** Realistic split:

- Week 1: hardening primitives (idempotency wrap + audit wrap + rate-limit wrap + error envelope + drift CI). One sprint of unglamorous infra. Sweep 38 existing tools onto the wrappers.
- Week 2: P0 + P1 tools (page lifecycle, user/permissions, language CRUD, site-wide content, trash). ~15 tools.
- Week 3: P2 (themes/images/orders/diagnostics/discovery), runbook, end-to-end CI test, schema drift CI. ~17 tools.

Could compress to 2 weeks with two engineers running in parallel (one on hardening, one on tool implementations).

## Dependency notes

- Builds on F2 (idempotency engine + cascade engine + Trash).
- Pairs with F5 (admin diagnostics — `tool.list` parallels the route registry).
- Doesn't depend on F1, F4, F6, F7 — they're independent.

## Open questions

1. **Should every admin-UI page eventually emit an MCP tool count + coverage badge?** "Posts: 4/4 operations available via MCP." Forces parity culture; cheap to add. Recommend YES (small ship in F5 admin diagnostics).
2. **Which MCP transport for streaming?** Server-sent events is the standard. Confirm the SDK supports it; if not, flag a transport upgrade as a sub-item of F8.
3. **Should `tool.list` honour the actor's mode + role?** Simplified-mode users see fewer tools. Recommend YES — already the pattern via `enforceModeForTool`; just filter the list output instead of letting the call fail later.
