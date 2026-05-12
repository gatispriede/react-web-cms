---
name: mcp-coverage-storefront-program
description: Comprehensive MCP tool catalogue across every new + existing editable surface in the storefront program. Enforces universal requirement #2 (MCP coverage parity). Every admin-mutable field has a matching MCP tool; every list / queryable has an introspection tool.
research: see research-findings-2026-05-12.md §1 (admin permissions) for the surfaces being MCP-covered
---

# MCP coverage — full storefront-program catalogue

## Goal

MCP is the canonical write path for AI authoring; admin UI is the human surface on top. **Universal requirement #2** ([README.md](../README.md)) demands every admin-mutable field has a matching MCP tool / extension in the same PR.

This doc is the **comprehensive catalogue** of MCP tools needed across the new storefront program. Each new roadmap item references back here for the tools it must ship.

Existing coverage as of 2026-05-12: ~87 tools across F8 + recent extensions. Below is the **delta** that the storefront program requires.

## Catalogue — by feature

Format: `tool_id({inputs}) → {output}` · description · which roadmap item ships it · `advancedOnly?: bool`.

### Customer accounts + auth (Wave 6c)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `customer_list` | `{cursor?, kind?, sortBy?, search?}` | `{items, nextCursor, total}` | client-signup | ✓ |
| `customer_get` | `{id}` | `{customer}` | client-signup | ✓ |
| `customer_update` | `{id, patch}` | `{ok}` | client-signup | ✓ |
| `customer_delete` | `{id, reason}` | `{ok}` | client-signup (POC scope only — full GDPR delete in Wave 8b) | ✓ |
| `customer_exportData` | `{id}` | `{exportUrl}` | Wave 8b (GDPR) — file forward-stub now | ✓ |
| `customer_resendMagicLink` | `{email}` | `{ok}` | client-signup | ✓ |
| `customer_setAuthMethod` | `{customerId, methods[]}` | `{ok}` | client-signup | ✓ |
| `authMethod_list` | `{}` | `{enabledMethods, defaultMethods}` | client-signup | — |
| `authMethod_setSiteConfig` | `{methods[], defaultMethod}` | `{ok}` | client-signup | ✓ |
| `oauth_provider_setSecret` | `{provider, clientId, clientSecret}` | `{ok}` | client-signup (encrypts via secretBox) | ✓ |

### Marketing attribution (Wave 6c)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `marketing_referrer_upsert` | `{slug, name, notes?}` | `{ok}` | client-signup | ✓ |
| `marketing_referrer_list` | `{}` | `{items}` | client-signup | — |
| `marketing_referrer_delete` | `{slug}` | `{ok}` | client-signup | ✓ |
| `marketing_attribution_report` | `{period, sourceFilter?, includeFirstTouch?, includeLastTouch?}` | `{signupsByCampaign, conversionByFirstTouch, lastTouchBreakdown, topReferrers}` | client-signup | — |
| `marketing_attribution_userJourney` | `{userId}` | `{firstTouch, lastTouch, conversions[]}` | client-signup | ✓ |

### Orders + reservations (Wave 7 — ss.com + existing Orders)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `order_createReservation` | `{productId, customerId?, guestEmail?, depositAmount, currency, idempotencyKey}` | `{orderId, orderToken?}` | ss.com | — |
| `order_releaseReservation` | `{orderId, reason}` | `{ok, refundId?}` | ss.com | ✓ |
| `order_extendReservation` | `{orderId, additionalHours}` | `{ok, newExpiry}` | ss.com | ✓ |
| `order_getByToken` | `{orderToken}` | `{order}` | client-signup (guest order lookup) | — |
| `order_list` | `{cursor?, status?, kind?, customerId?}` | `{items, nextCursor, total}` | extension of existing | ✓ |
| `order_addNote` | `{orderId, note, internalOnly?}` | `{ok}` | new (operator notes on orders) | ✓ |

### Saved searches (Wave 6b)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `savedSearch_list` | `{customerId?, listSlug?}` | `{items}` | faceted-filter | — |
| `savedSearch_get` | `{id}` | `{search}` | faceted-filter | — |
| `savedSearch_create` | `{customerId, listSlug, title, filterUrl, alertChannel, alertCadence}` | `{id}` | faceted-filter | — |
| `savedSearch_update` | `{id, patch}` | `{ok}` | faceted-filter | — |
| `savedSearch_delete` | `{id}` | `{ok}` | faceted-filter | ✓ |
| `savedSearch_runNow` | `{id}` | `{newMatchCount, notifiedAt}` | faceted-filter | ✓ |

### Faceted-filter config (Wave 6b)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `productList_config_get` | `{slug}` | `{config}` | faceted-filter | — |
| `productList_config_upsert` | `{slug, config}` | `{ok}` | faceted-filter | ✓ |
| `productList_config_list` | `{}` | `{items}` | faceted-filter | — |
| `productList_config_delete` | `{slug}` | `{ok}` | faceted-filter | ✓ |
| `productList_facet_distinctValues` | `{slug, facetKey, filter?}` | `{values: [{value, count}]}` | faceted-filter | — |

### Warehouse / Inventory adapters — extensions (Wave 7)

Existing tools: `inventory_status`, `inventory_syncDelta`, `inventory_readDeadLetters`. New:

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `inventory_runIngest` | `{adapterId, mode: 'full' \| 'delta'}` | `{runId, started}` | ss.com (existing tool, verify) | ✓ |
| `inventory_dryRun` | `{adapterId, sampleSize}` | `{rows, errors}` | ss.com | ✓ |
| `inventory_remapField` | `{adapterId, src, dst}` | `{ok, affectedCount}` | ss.com | ✓ |
| `inventory_adapter_list` | `{}` | `{adapters: [{id, status, lastRun, config}]}` | ss.com | — |
| `inventory_adapter_setConfig` | `{adapterId, config}` | `{ok, restartRequired?}` | ss.com (encrypts secrets via secretBox) | ✓ |
| `inventory_adapter_healthCheck` | `{adapterId}` | `{ok, latencyMs, message?}` | ss.com | — |
| `inventory_adapter_register` | `{adapterId, factoryRef}` | `{ok}` | ss.com (for plugin SDK adapter authors) | ✓ |
| `product_setVatRegime` | `{productId, regime}` | `{ok}` | ss.com (operator review queue) | ✓ |
| `product_setManualOverride` | `{productId, field}` | `{ok}` | extension (manual-pin against warehouse) | ✓ |
| `product_clearManualOverride` | `{productId, field}` | `{ok}` | extension | ✓ |
| `ss_com_listing_blacklist` | `{externalId, reason}` | `{ok}` | ss.com (suppress bad upstream listings) | ✓ |
| `ss_com_listing_force_unavailable` | `{productId}` | `{ok}` | ss.com (operator override) | ✓ |

### Content Releases (Wave 2.5e)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `release_list` | `{cursor?, status?}` | `{items, nextCursor}` | content-releases | — |
| `release_get` | `{id, includeMembers?}` | `{release}` | content-releases | — |
| `release_create` | `{title, description?}` | `{id}` | content-releases | ✓ |
| `release_addMember` | `{releaseId, entity, id}` | `{ok}` | content-releases | ✓ |
| `release_removeMember` | `{releaseId, entity, id}` | `{ok}` | content-releases | ✓ |
| `release_preview` | `{releaseId}` | `{previewUrl}` | content-releases | — |
| `release_publish` | `{releaseId, idempotencyKey}` | `{ok}` | content-releases | ✓ |
| `release_schedule` | `{releaseId, when}` | `{ok}` | content-releases | ✓ |
| `release_unschedule` | `{releaseId}` | `{ok}` | content-releases | ✓ |
| `release_rollback` | `{releaseId, reason}` | `{rollbackReleaseId}` | content-releases | ✓ |

### Permissions UX — groups + tier expansion (Wave 2.5c)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `group_list` | `{}` | `{items}` | permissions-ux | — |
| `group_get` | `{id, includeMembers?}` | `{group}` | permissions-ux | — |
| `group_create` | `{name, description?, memberUserIds?}` | `{id}` | permissions-ux | ✓ |
| `group_update` | `{id, patch}` | `{ok}` | permissions-ux | ✓ |
| `group_addMember` | `{groupId, userIds[]}` | `{ok, added}` | permissions-ux (bulk write) | ✓ |
| `group_removeMember` | `{groupId, userIds[]}` | `{ok, removed}` | permissions-ux (bulk write) | ✓ |
| `group_delete` | `{id, reason}` | `{ok}` | permissions-ux | ✓ |
| `permission_applyTier` | `{scope, tier, userId?, groupId?}` | `{ok, grantsApplied}` | permissions-ux | ✓ |
| `permission_applyRolePreset` | `{preset, userId?, groupId?}` | `{ok}` | permissions-ux | ✓ |
| `permission_effectiveFor` | `{userId, includeOverrideSources?}` | `{grants, overrides}` | permissions-ux | — |

### First-class themes (Wave 5)

Existing: `theme_list / theme_get / theme_create / theme_update / theme_delete / theme_setActive / theme_resetPreset`. Extensions:

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `theme_list { includeUsage }` | `{includeUsage: true}` | `{items: [{id, usage: {pages: n, sites: n}}]}` | F8-bulk-introspection + first-class-themes | — |
| `theme_getTokens` | `{id, mode: 'light' \| 'dark' \| 'both'}` | `{tokens}` | first-class-themes | — |
| `theme_setTokens` | `{id, tokens, mode?}` | `{ok}` | first-class-themes | ✓ |
| `theme_clone` | `{sourceId, newSlug, newName}` | `{id}` | first-class-themes | ✓ |
| `theme_setHeaderBehavior` | `{id, behavior: 'sticky-static' \| 'shrink-on-scroll' \| 'headroom' \| 'slim-utility'}` | `{ok}` | first-class-themes | ✓ |
| `theme_setFooterLayout` | `{id, layout: 'minimal' \| 'multi-column' \| 'brand-led' \| 'link-farm'}` | `{ok}` | first-class-themes | ✓ |
| `theme_setMotionScale` | `{id, scale: 'default' \| 'slow' \| 'snappy'}` | `{ok}` | first-class-themes | ✓ |
| `theme_setLogoVariant` | `{id, variant: 'full' \| 'mark' \| 'monochrome', logoAssetId}` | `{ok}` | first-class-themes | ✓ |
| `theme_runA11yCheck` | `{id, mode}` | `{violations, score}` | accessibility-wcag22-audit | — |

### Modules — every module type

For each module type (Hero, Manifesto, Gallery, Carousel, RichText, PlainText, Timeline, StatsCard, Testimonials, ProjectGrid, Services, SocialLinks, **+ all new modules** below), MCP coverage requires:

| Tool | Inputs | Output | Notes |
|---|---|---|---|
| `module_listTypes` | `{}` | `{types: [{id, label, defaultContent, schema}]}` | extension — adds new types |
| `module_add` | `{sectionId, type, content, position?}` | `{moduleId}` | extension |
| `module_update` | `{moduleId, contentPatch}` | `{ok}` | extension |
| `module_remove` | `{moduleId}` | `{ok}` | extension |
| `module_reorder` | `{sectionId, moduleIds[]}` | `{ok}` | bulk |

**New module types** (see [new-modules-catalogue.md](new-modules-catalogue.md)) auto-register through the existing module registry; no per-type MCP work beyond schema declarations in their `feature.manifest.ts`.

### Email templates (Wave 6a)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `email_template_list` | `{}` | `{items}` | receipt-emails | — |
| `email_template_preview` | `{templateId, fixtureInput?}` | `{html, text, subject}` | receipt-emails | — |
| `email_template_sendTest` | `{templateId, to, fixtureInput}` | `{ok, messageId}` | receipt-emails | ✓ |
| `email_template_sendReal` | `{templateId, to, input}` | `{ok, messageId}` | receipt-emails (used by services internally; exposed for ad-hoc operator sends) | ✓ |
| `email_log_query` | `{cursor?, since?, recipientHash?, templateId?}` | `{items, nextCursor}` | receipt-emails | ✓ |

### Onboarding + empty states (Wave 2.5b)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `onboarding_status` | `{}` | `{complete, currentStep?}` | empty-states-onboarding | — |
| `onboarding_seedSample` | `{force?}` | `{ok, seededIds}` | empty-states-onboarding | ✓ |
| `onboarding_resetWizard` | `{}` | `{ok}` | empty-states-onboarding | ✓ |
| `onboarding_completeStep` | `{step, payload?}` | `{ok}` | empty-states-onboarding | ✓ |

### Inline editing (Wave 2.5d)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `editorPath_resolve` | `{editTarget}` | `{entity, id, field?, route}` | inline-editing | — |
| `editorPath_dispatch` | `{editTarget}` | `{ok, opened: route}` | inline-editing | — |

### Accessibility (Wave 8a)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `accessibility_runAudit` | `{routes[], themes[], modes[]}` | `{violations}` | accessibility-wcag22-audit | — |
| `accessibility_report` | `{since?}` | `{summary, byRoute}` | accessibility-wcag22-audit | — |
| `accessibility_baselineFor` | `{route, theme, mode}` | `{snapshotId, violationCount}` | accessibility-wcag22-audit | — |

### Toast / notification (Wave 0c)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `notification_listRecent` | `{cursor?, since?}` | `{items}` | sonner-toast | — |
| `notification_setPreference` | `{userId, channel, optIn}` | `{ok}` | client-signup | ✓ |

### Command palette (Wave 2.5a)

| Tool | Inputs | Output | Ships with | Advanced |
|---|---|---|---|---|
| `command_listActions` | `{scope?}` | `{actions: [{id, name, section, shortcut}]}` | command-palette | — |
| `command_invoke` | `{actionId, args?}` | `{ok, result?}` | command-palette (lets MCP trigger any palette action) | ✓ |

## Universal patterns for new tools

Every tool follows these conventions:

1. **Pattern F from [agent-handoff-format.md](agent-handoff-format.md)** — `defineTool` from `_shared.ts`, zod input schema, advanced-only gate where mutations affect site state.
2. **Bulk shape (`items[]` / `ids[]`)** — any mutation tool that could plausibly run on multiple records ships the bulk variant from day 1 (per F8-bulk-introspection precedent).
3. **Introspection shape (`includeX?: boolean`)** — list/get tools that have natural aggregation flags (`includeUsage`, `includeMembers`, `includeMissing`) ship them.
4. **Idempotency key on every destructive mutation** — `idempotencyKey: string` input (32-char min), replay-safe through existing idempotency engine.
5. **Audit trail** — every mutation runs through `runMutation` so the Audit feature catches it.
6. **MCP schema-drift CI** — `tools/scripts/mcp-schema-drift.mjs` fails the build if a GraphQL mutation exists without a matching MCP tool. The new mutations added by storefront items must pass.

## Acceptance — overall MCP parity

1. Every new editable surface in the storefront program has a matching MCP tool (catalogue above is the gate)
2. Every new mutation tool supports bulk shape where multi-record operation is plausible
3. Every new list tool supports at least one introspection flag where aggregation is useful
4. `mcp-schema-drift` CI passes against the full set of new mutations
5. Advanced-only gating applied per the catalogue (mutations affecting site state — yes; pure reads — no)
6. Each ship-time roadmap item lists its specific MCP tools in its acceptance section + adds tests for each tool

## Effort

This is a **catalogue, not a single chunk.** Each tool lands with its parent roadmap item. Estimate the MCP work as **~10-15% of the parent item's AI agent time** — a tool definition + zod schema + handler + 1-2 unit tests averages ~15-25 min AI per tool.

Aggregate across the storefront program: **~6-8 hours AI** distributed across Waves 2.5, 6, and 7.

## Dependencies

- Existing MCP `defineTool` + `compose` patterns (shipped)
- Existing `enforceModeForTool` gate (shipped)
- Existing `mcp-schema-drift.mjs` CI script (shipped)

## Out of scope

- Plugin-author SDK (advertising `defineTool` as a public API for third-party MCP tools). Deferred to F8-sdk in [backlog.md](../backlog.md).
- Streaming transport for long-running MCP tools — covered by F8-stream (already queued).
- MCP tool discovery / introspection endpoints — covered by existing `tool_list` + `tool_describe`.
