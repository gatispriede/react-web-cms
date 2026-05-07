# MCP — bulk-write + introspection sweep

## Goal

Two parallel gaps that block agent-driven editing today:

1. **Bulk-write primitives across the mutation surface.** An LLM authoring a typical page hits 15-20 `section.update` calls. Wiring permissions for a new editor is 5+ `permission.grant` calls. Updating SEO across 5 pages is 5 `page.update` calls. Each is a separate round-trip + audit row + rate-limit slot. Add an optional `items: T[]` array variant to every mutation tool, mirroring the `image.delete { ids[] }` pattern shipped 2026-05-07.

2. **Introspection on read tools.** Today the agent has to download a full tree and diff in memory to answer "which translation keys are missing in Latvian?", "which themes have never been activated?", "which pages have no SEO description?". Move that logic server-side via optional aggregating flags on the `*.list` tools (the `image.list { includeUsage }` pattern, also from 2026-05-07).

Together they're the same theme — primitive, reusable extensions to existing tools rather than narrow task-specific tools.

## Why now

- **Translation work via MCP is the immediate driver.** Adding a language today: agent calls `i18n.listLanguages`, dumps every key/value pair across every locale into its context, manually diffs to find missing keys, then calls `i18n.upsertKeys` for the gaps. With `i18n.listLanguages { includeMissing: true }` the diff happens on the server in one round-trip and the agent gets a clean missing-key matrix.
- **Bulk pattern proven on `image.delete`.** The shape is settled: optional array form alongside the single-id form, per-item results in `data.failed[]`, single-item shape stays back-compat. Mechanical to apply across ~15 other tools.
- **Reusable beyond agents.** The admin "show unused" / "show missing" filters use the same server-side logic. UI ergonomics improves alongside MCP capability.

## Design

### Bulk-write extensions

Apply to every tool that's currently single-item-write. Pattern:

```ts
inputSchema: {
  properties: {
    // existing single-item field stays
    id: { type: 'string', ... },
    // new optional array variant; mutually exclusive with single
    ids: { type: 'array', items: {type: 'string'}, ... },
    // OR for tools with a body payload:
    items: { type: 'array', items: {type: 'object', properties: {...}}, ... },
  }
}
```

Handler runs each item in sequence (one prefetch shared across the batch where applicable), returns:

```ts
{
  ok: failed.length === 0,
  deletedCount / updatedCount / createdCount: number,
  failedCount: number,
  results: [{ id, ok: boolean, error?: string, ...itemResult }],
  failed: [{ id, error }],   // convenience subset
}
```

Single-item form returns the original flat shape; bulk form returns the new shape. Idempotency key applies to the whole batch.

**Tools to extend (priority order):**

| Tool | Bulk variant | Notes |
|------|-------------|-------|
| `section.update` | `items: ISection[]` | Highest agent-call volume — page authoring loop |
| `module.add` / `module.update` / `module.remove` | `items[]` / `ids[]` | Same loop |
| `page.update` | `items: {page, ...}[]` | SEO sweeps, audit-triplet stamping |
| `post.upsert` | `items: IPost[]` | Bulk import / migration |
| `product.create` / `product.update` | `items[]` | Catalog imports |
| `permission.grant` / `permission.revoke` | `items[]` | Onboarding / offboarding workflows |
| `user.setRole` / `user.update` | `items[]` | Role flips across cohorts |
| `translation.set` / `translation.delete` | `items[]` | Already partially covered by `i18n.upsertKeys`; mirror for delete |
| `trash.restore` / `trash.purge` | `groups: string[]` | Today accepts one trashGroup |
| `image.delete` | **shipped 2026-05-07** | Reference implementation |

Skip: `bundle.import`, `*.export` (already bulk by nature), `site.publish` (singleton).

### Introspection extensions on read tools

Apply to `*.list` tools where a useful aggregation exists. Pattern:

```ts
inputSchema: {
  properties: {
    // existing filters stay
    tags: { type: 'string', ... },
    // new optional flags
    include<X>: { type: 'boolean', description: 'Server-side aggregation. ...' },
    <something>Only: { type: 'boolean', description: 'Filter to subset (no-op without include<X>).' },
  }
}
```

**Tools to extend:**

| Tool | New flag | What it returns | Drives |
|------|----------|----|----|
| `i18n.listLanguages` | `includeMissing: bool`, `missingOnly: bool` | per-language `missingKeys: string[]` (vs default-language baseline), `coverage: number` (0-100%) | Agent-driven translation work |
| `i18n.listLanguages` | `keysOnly: bool` | flat array of all keys without values (lightweight scaffolding) | UI key-pickers |
| `image.list` | **shipped 2026-05-07** | `usageCount`, `usedIn[]` | Reference impl |
| `theme.list` | `includeUsage: bool` | `isActive: bool`, `everActivated: bool` | Theme cleanup |
| `page.list` | `includeSectionCount: bool` | `sectionCount`, `lastEditedAt` | Admin overview |
| `page.list` | `includeSeoStatus: bool` | `hasDescription`, `hasOgImage`, missing-fields[] | SEO sweep |
| `post.list` | `includeStats: bool` | `wordCount`, `imageCount`, `tagCount` | Editorial dashboard |
| `module.listTypes` | `includeUsage: bool` | per-type `usageCount` (sections referencing it), `pages: string[]` | Module deprecation |
| `permission.list` | `includeResources: bool` | resolved page/section names instead of just IDs | Admin overview |
| `user.list` | `includeActivity: bool` | `lastLoginAt`, `editsLast30d`, `pagesEdited` | Stale-account audit |

Each is a small server-side aggregation. Use the same shared scanner pattern (`ImageUsageService`-style) so the logic is reusable from the admin UI's "show unused" / "show missing" filters.

### Translation-specific helpers (subset)

Beyond the generic `includeMissing`, three translation tools are worth pulling out since the workflow is so common:

| Tool | Shape | Notes |
|------|-------|-------|
| `i18n.diff` (new) | `(symbolA, symbolB) → {onlyInA[], onlyInB[], differingValues[]}` | Compare two locales without dumping both trees |
| `i18n.scanCodebase` (new, optional) | `() → {keys: string[], byFile: {file, keys[]}}` | Walks `t('...')` and `<Trans i18nKey>` calls in `ui/` source. Optional because agents can grep instead. |
| `translation.deleteKeys` (bulk variant) | `items: [{symbol, key}, ...]` | Mirror of `i18n.upsertKeys` for cleanup |

`i18n.scanCodebase` is the genuinely novel one — without it, an agent can't reliably know "what keys does the app actually use that no language has?" If we skip it, agents fall back to `Read`/`Grep` against source which is fine but less canonical.

## Files to touch

**Per bulk-write tool:** ~10 lines of schema + handler refactor + 2 test cases. ~12 tools × ~30 min = half a day mechanical.

**Per introspection extension:** ~30-50 lines (the aggregation logic) + 2-3 test cases. ~10 extensions × ~1h = 1.5 days.

**Shared infrastructure:**
- `services/features/Mcp/tools/_shared.ts` — extract a `runBatch(items, fn) → {results, failed, count}` helper so each tool doesn't roll its own loop. ~half a day to design + tests.

**Scanner placement — per-feature, not centralised** (decided 2026-05-07).

Each introspection scanner lives **inside the feature it scans**, mirroring `ImageUsageService` in `services/features/Assets/`. The MCP tool imports the scanner; the admin UI's "show unused / missing" filters import the same scanner. No `services/features/Mcp/tools/_introspection.ts` central pile.

| Scanner | Lives in | Used by |
|---------|----------|--------|
| `ImageUsageService` (existing) | `services/features/Assets/` | `image.list { includeUsage }`, admin "Show unused" filter |
| `TranslationDiffService` (new) | `services/features/Languages/` | `i18n.listLanguages { includeMissing }`, `i18n.diff`, admin "Show missing" filter |
| `ThemeUsageService` (new) | `services/features/Themes/` | `theme.list { includeUsage }`, admin "Hide unused" |
| `PageSeoStatusService` (new) | `services/features/Seo/` | `page.list { includeSeoStatus }`, admin SEO sweep |
| `ModuleUsageService` (new) | `services/features/Modules/` | `module.listTypes { includeUsage }`, deprecation tooling |
| `UserActivityService` (new) | `services/features/Users/` | `user.list { includeActivity }`, stale-account audit |
| `PermissionResolver` (new) | `services/features/Permissions/` | `permission.list { includeResources }`, admin overview |
| `PostStatsService` (new) | `services/features/Posts/` | `post.list { includeStats }`, editorial dashboard |

Each scanner is its own file with co-located tests (`<Name>Service.test.ts`). MCP tools become thin adapters that import the right scanner and project its output into the response shape. Admin UI features can call the scanner directly via the existing service-loader DI without depending on MCP.

This keeps `services/features/Mcp/` focused on *transport + dispatch* — not on holding business logic about every other feature.

**Admin UI follow-ups (optional, separate PR):**
- Image manager "Show unused" filter (consumes `image.list { includeUsage, unusedOnly }`)
- Translation manager "Show missing" filter (consumes `i18n.listLanguages { includeMissing, missingOnly }`)
- Theme manager "Hide unused" filter
- These are paper-cut wins for human admins; same MCP backend.

## Acceptance

1. **Bulk image cleanup via MCP**: `image.list { includeUsage:true, unusedOnly:true }` → ids → `image.delete { ids: [...] }` succeeds in 2 calls. ✓ (already shipped)
2. **Translation diff via MCP**: `i18n.listLanguages { includeMissing:true }` returns a per-language `missingKeys[]` shorter than the full key dump. Agent fills gaps with one `i18n.upsertKeys` per language.
3. **Bulk page section authoring**: AI generates 18 sections; one `section.update { items: [...] }` call lands them with one audit row per section.
4. **Failure isolation**: bulk call with one bad item returns 200 OK with `data.ok: false`, `data.failed: [{id, error}]`. The 17 good items committed.
5. **Back-compat**: every existing single-item caller works unchanged (no schema break).
6. **Drift CI** (`tools/scripts/mcp-schema-drift.mjs`) is green — every tool that exposes a bulk variant lists it in the description.

## Effort

**M-L · ~3 days, shipped as one chunk.** Bulk-write + introspection share the same scanner/runBatch infrastructure and the same schema-drift CI updates — splitting them means writing the shared infra twice or merging an incomplete surface where some tools have bulk and others don't, some lists have `includeUsage` and others don't. Land together.

Internal time-share: bulk-write extensions (~12 tools mechanical) ~1d, introspection extensions (~10 read-tool flags + scanner services) ~1.5d, tests + schema-drift CI updates + documentation pass ~0.5d.

## Dependency notes

- Builds on the F8 `defineTool` + `compose` infrastructure (already shipped 2026-05-04).
- `image.list` + `image.delete` extensions (shipped 2026-05-07) are the reference implementations — copy the pattern.
- The `ImageUsageService` (shipped same day) is the model for other introspection scanners.
- Doesn't depend on F6 / mobile / GHCR / anything outside MCP.

## Open questions

1. **Bulk size cap?** `image.delete { ids[] }` allows up to 500 today. Same cap for `section.update { items[] }` etc., or different per-tool? Recommend uniform 500; tools that genuinely need more (bundle migration) already have `bundle.import`.
2. **Atomic vs best-effort batch?** Today the bulk shape is best-effort with per-item failure reports. Should any tool (e.g. `permission.grant`) be all-or-nothing under a transaction? Recommend stay best-effort uniformly — agents handle partial-failure cleanly via `failed[]`; transactions add complexity without a clear use case.
3. **`i18n.scanCodebase`** — ship it or let agents grep? Recommend ship — gives a canonical, testable answer; otherwise every agent rolls its own walk.
4. **Description tagging** — should the tool description explicitly list `Bulk: yes / no` so the agent's tool-picker surfaces this at a glance? Recommend yes; one-line addition per tool.
