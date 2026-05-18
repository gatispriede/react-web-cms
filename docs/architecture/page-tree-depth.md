# Page tree depth — design notes

**Phase 1.C** (products-as-composable-page).

## Why we removed the cap

Earlier waves capped `IPage.parent` chains at 3 levels — a sensible
default while pages were a hand-authored medium. Auto-derived category
trees (cars: `Cars → Used → Sedan → BMW → 3-Series → 2018-330i`) are
routinely 5–6 levels; the cap became load-bearing-wrong.

Phase 0b lifted it to a **soft warning at depth 8** (configurable via
the MCP `pages.warehouseSync.depth.set` tool). N-deep traversal is
exercised by:

- `services/features/Anchors/AnchorRegistry.ts` — `chainFor` walks
  root → self with a visited-set guard. No depth cap.
- `services/features/Seo/defaultSitemapContributors.ts` — uses
  `slugChainForPage` which is depth-agnostic.
- `ui/client/pages/[...slug].tsx` — `getStaticPaths` emits one path
  per (page × locale) combination from the full chain; `fallback:
  'blocking'` renders first-hit pages then caches.

## Performance — what we did about it

Tens of thousands of derived pages need careful handling. Mitigations
shipping in 1.C:

1. **Mongo compound index `(parent, slug)`** on the Navigation
   collection. The `PagesServiceLoader.indexes` ships the index spec;
   the platform's idempotent index registrar applies it once at boot.
   Slug walks are O(depth) regardless of total page count.

2. **`fallback: 'blocking'`** — the catch-all route renders new pages
   on first hit + caches via the W8d caching tier. Cold-cache hit
   ≈ 200ms once Mongo + Next have warmed.

3. **Sitemap index split** — already shipped via W8h polish. Once
   entry count crosses ~50k, the contributor emits a sitemap-index
   pointing at chunked sitemaps. No 1.C work needed.

4. **Admin tree-view lazy expansion** — deferred to a follow-up jump.
   The current implementation crashes nicely (no infinite loop) at
   deeper levels but doesn't yet virtualise. Acceptable until customer
   warehouses cross ~500 pages.

5. **Breadcrumb cache** — `pageBreadcrumb(pageId)` results are cached
   in the page-level loader for 5 min; invalidated on page rename via
   the existing `cache.bumpVersion` (W7c) channel.

## Soft warning at depth 8

The threshold is in-process (no Mongo persistence) — adjustable via the
MCP `pages.warehouseSync.depth.set` tool. Hitting the threshold emits
an audit-log entry; it does **not** reject the write. Rationale:
warehouses occasionally need a 9–10 level taxonomy (legal /
regulatory subcategories) and the operator should be informed, not
blocked.

## Backwards compatibility

Legacy operator-authored 3-level pages keep working unchanged. The
`IPage.source` discriminator (`'manual' | 'product' | 'system-page'`,
Phase 0b) lets every consumer pick the right strategy without a global
flag day.

## Auto-301 on warehouse-derived rename (Phase 1.C-c)

When a warehouse adapter renames a product upstream (its `title` —
and therefore `slugify(title)` — changes), the
`WarehousePageSyncWorker` detects the slug delta by matching the
new product row against the existing Navigation row via `productId`.

Operator decision: **auto-create + audit-log**. The worker calls
`port.createRedirect({from: '/old', to: '/new', code: 301})` BEFORE
writing the new page so the renamed URL is reachable as soon as the
new page lands.

**Idempotency contract**:

- The port impl in `PagesServiceLoader.createWarehousePort` invokes
  `RedirectsService.create(...)`. That service throws
  `"redirect already exists for /<path>"` on a duplicate `from`.
- Both layers (port + worker) catch the "already exists" string and
  drop to an `info`-level log line. An operator-edited redirect for
  the same `from` is **never** overwritten — the operator wins.

**Audit trail**: every successful auto-create writes an `AuditService`
row with `collection: 'Redirects'`, `op: 'create'`,
`tag: 'warehouse-derived-rename'`, and a `diff.after` payload of
`{from, to, code, reason}`. The MCP `audit.list` tool surfaces these
rows; the `reason` string carries the productId + slug delta for
diagnosability.

**No new MCP tools**: the existing W8h
`redirect.list / redirect.create / redirect.update / redirect.delete`
suite covers operator inspection + manual override. Auto-redirects
are normal rows in the `Redirects` collection — they show up in
`redirect.list` alongside hand-authored entries.
