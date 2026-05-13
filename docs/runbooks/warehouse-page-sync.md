# Runbook — Warehouse page sync

**Phase 1.C** (products-as-composable-page sub-jump B). Cron-driven
worker that mirrors each registered warehouse adapter's product
catalogue into the `IPage` tree.

## How it runs

- Owner: `services/features/Pages/PagesServiceLoader.ts`.
- Worker: `services/features/Pages/WarehousePageSyncWorker.ts`.
- Interval: 5 minutes (configurable per-test via `intervalMs`).
- Gated on the `commerce.warehouseAutoSync` site-flag (default **on**).
- One tick walks every registered adapter, pulls up to 1000 product
  rows per adapter, buckets by `adapter.getCategoryHierarchy()`,
  diffs against existing `IPage` rows where `source === 'product'`,
  and writes the delta.

## How to opt out

Two ways:

1. Flip `commerce.warehouseAutoSync` off via MCP:

    ```bash
    mcp commerce.config.update --path commerce.warehouseAutoSync --value false
    ```

    The next tick short-circuits. Manual sync via `pages.warehouseSync.run`
    still works.

2. Stop the process and unset the adapter config — no adapters
   registered means no pages built.

## Operator overrides

If you hand-edit a warehouse-derived page (`source: 'product'`), the
worker detects the edit via two heuristics:

- the page's section-list fingerprint diverges from the template's,
- OR `editedAt > createdAt + 60s`.

Once edited, subsequent sync runs only update `derivedFrom.lastSyncedAt`
+ SEO metadata. Your added / reordered sections are preserved.

To force the worker to re-apply the template (e.g. you want the auto
layout back), delete the page row and let the next tick re-create it.

## What happens when a warehouse product disappears

- Leaf product page (one with `IPage.productId` bound): soft-deleted on
  the next tick after the product is missing. Soft-delete uses the
  existing `cascadeDelete` machinery (24h TTL). If the product reappears
  within 24h, the restore is automatic.
- Empty category branch: soft-deleted likewise.

## MCP tools

| Tool                                    | Purpose                                      |
| --------------------------------------- | -------------------------------------------- |
| `pages.warehouseSync.run`               | Force a sync now (optionally per-adapter)    |
| `pages.warehouseSync.status`            | Last run's counts + timestamps               |
| `pages.warehouseSync.preview`           | Dry-run — what would change without writes   |
| `pages.warehouseSync.depth.get`         | Read the soft-warning depth threshold        |
| `pages.warehouseSync.depth.set`         | Set the threshold (1–30; default 8)          |

## Troubleshooting

- **Worker hasn't run** — check `pages.warehouseSync.status`. `{found:
  false}` means no run has completed this boot. Check the
  `commerce.warehouseAutoSync` flag + the `pages.boot.warehouseSync`
  log line for adapter-list errors.
- **Pages keep recreating** — the operator edit heuristic missed your
  changes. Inspect the page's `editedAt` vs `createdAt`; if both are
  identical (legacy backfill) save once via the admin to bump
  `editedAt`.
- **Soft-deletes thrashing** — your adapter's `externalId` isn't
  stable across fetches. Fix the adapter to return identical ids per
  product across runs.
