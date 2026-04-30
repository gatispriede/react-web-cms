# Inventory / Warehouse Adapter

## Overview

The Inventory feature pulls product records from an **external warehouse / inventory system of record** and syncs them into the CMS `Products` collection. It is the upstream half of the e-commerce pipeline: warehouse → Inventory sync → Products module → public storefront.

The warehouse type has not been chosen yet (Postgres, MSSQL, REST API, CSV feed are all candidates), so the feature is built around a **pluggable adapter interface**. A concrete adapter is selected at runtime from admin config; ships with one or two reference implementations (`PostgresAdapter`, `RestApiAdapter`).

> **Status: design-only.** This spec is implementation-blocking on the [open questions](#open-questions) at the bottom — do not start coding until the warehouse type is fixed.

## Module shape

Mirrors the existing feature layout (`Bundle/`, `Posts/`, `Themes/`):

```
services/features/Inventory/
├── InventoryService.ts          # orchestrator (syncAll, syncDelta, status)
├── InventoryService.test.ts     # MongoMemoryServer + MockAdapter
├── adapters/
│   ├── IWarehouseAdapter.ts     # interface + shared types
│   ├── index.ts                 # adapter registry (id → factory)
│   ├── MockAdapter.ts           # tests / dev default
│   ├── GenericFeedAdapter.ts    # internet lookup: CSV / JSON / NDJSON URL with auth + pagination presets
│   ├── PostgresAdapter.ts       # direct DB (keyset cursor)
│   ├── RestApiAdapter.ts        # custom REST (kept for shapes the generic feed cannot express)
│   ├── ShopifyAdapter.ts        # common platform
│   ├── WooCommerceAdapter.ts    # common platform
│   ├── BigCommerceAdapter.ts    # common platform
│   ├── SquareAdapter.ts         # common platform
│   ├── AirtableAdapter.ts       # common platform
│   ├── GoogleSheetsAdapter.ts   # common platform
│   ├── NetSuiteAdapter.ts       # enterprise
│   ├── SapBusinessOneAdapter.ts # enterprise
│   └── OdooAdapter.ts           # enterprise
└── mapping/
    ├── fieldMap.ts              # warehouse-row → Product-shape transform
    └── presets/                 # per-platform field-map presets used by adapters above
ui/admin/features/Inventory/
├── InventoryPanel.tsx           # status, last-run log, manual sync button
└── AdapterConfigForm.tsx        # connection string / API key form
```

GraphQL is added to the existing schema under `inventory` namespace (queries `inventoryStatus`, mutations `inventorySyncAll`, `inventorySyncDelta`, `inventorySaveAdapterConfig`).

## 1. Adapter interface

`services/features/Inventory/adapters/IWarehouseAdapter.ts`:

```ts
export interface WarehouseProductRow {
  externalId: string;          // stable id in the warehouse — upsert key
  sku?: string;
  title: string;
  description?: string;
  priceCents: number;
  currency: string;            // ISO-4217, e.g. 'EUR'
  stock: number;
  images?: string[];           // remote URLs; downloaded on first sync
  attributes?: Record<string, unknown>;
  updatedAt: string;           // ISO timestamp from the source system
}

export interface FetchPage {
  items: WarehouseProductRow[];
  nextCursor: string | null;   // null = end of stream
}

export interface HealthResult {
  ok: boolean;
  latencyMs: number;
  message?: string;
  adapter: string;             // self-reported adapter id
}

export interface IWarehouseAdapter {
  readonly id: string;         // 'postgres' | 'rest' | 'mock'
  /** Page through *all* products. Cursor is opaque to the orchestrator. */
  fetchProducts(cursor?: string): Promise<FetchPage>;
  /** Page through products updated since `since`. Used by syncDelta. */
  fetchProductsSince?(since: string, cursor?: string): Promise<FetchPage>;
  healthCheck(): Promise<HealthResult>;
}
```

### Cursor / pagination contract

- Cursor is an **opaque string** owned by the adapter — orchestrator never inspects it.
- A page may be empty with `nextCursor !== null` (adapter is allowed to skip filtered rows).
- Adapter MUST cap a single page at a sane size (suggest 200) to keep memory bounded.
- `fetchProductsSince` is optional. If not implemented, `syncDelta` falls back to `syncAll` filtered by `updatedAt > lastRun`.

## 2. Concrete adapters

### `PostgresAdapter`

- Config: `{ connectionString, schema?, productsTable, mapping }`.
- Uses `pg` (Pool) — already dep-eligible if not present.
- Cursor = base64 of `(updated_at, external_id)` for stable keyset pagination (no OFFSET).
- `healthCheck`: `SELECT 1` with a 2 s timeout.
- Field mapping is config-driven: `{ externalId: 'id', priceCents: 'price_cents', ... }` so different schemas can be onboarded without code edits.

### `RestApiAdapter`

- Config: `{ baseUrl, authMode: 'bearer'|'apiKey'|'basic', credential, listPath, pageParam, cursorParam, fieldMap }`.
- Honors HTTP `Retry-After`, exponential backoff on 5xx (3 retries).
- Cursor = whatever the API returns (`next` URL, opaque token, or numeric page).
- `healthCheck`: `GET ${baseUrl}${healthPath || '/'}` with a 5 s timeout.

### `MockAdapter` (test-only)

- In-memory fixture, deterministic cursor (`page-1`, `page-2`, …). Used by `InventoryService.test.ts` and as the default when `INVENTORY_ADAPTER=mock` (dev mode).

### `GenericFeedAdapter` (internet lookup, zero-code onboarding)

The catch-all for "we have a URL that returns the catalogue". Configured entirely from the admin form — no adapter code per source. Handles four payload shapes auto-detected from the response `Content-Type` and a quick sniff of the body:

| Shape | Detection | Notes |
|---|---|---|
| JSON array | `application/json`, body starts with `[` | Each element is one product. |
| JSON object with array property | `application/json`, body starts with `{` | Operator names the array property (`items`, `data`, `products`, …) in config; auto-detect picks the longest array if unspecified. |
| NDJSON (line-delimited JSON) | `application/x-ndjson` or `application/jsonl` | One product per line. |
| CSV / TSV | `text/csv`, `text/tab-separated-values` | First row = header. Delimiter auto-detected. |

Config (all optional except `url`):

```ts
interface GenericFeedConfig {
  url: string;                                  // HTTPS recommended
  authMode?: 'none' | 'bearer' | 'apiKey' | 'basic';
  credential?: string;                          // stored as a secret
  itemsPath?: string;                           // JSONPath into the response, default auto-detect
  pagination?:
    | { kind: 'none' }
    | { kind: 'link-header' }                   // RFC 5988 `Link: <next>; rel="next"`
    | { kind: 'cursor', cursorParam: string, cursorPath: string }     // body.next_cursor → `?cursor=...`
    | { kind: 'page',   pageParam: string,   pageStart?: number }     // `?page=N` until empty
    | { kind: 'offset', offsetParam: string, limitParam: string, limit: number };
  fieldMap: Record<keyof WarehouseProductRow, string>;  // JSONPath / CSV column per field
  pollInterval?: string;                        // cron expression, default '*/30 * * * *'
}
```

Field mapping is **the only non-trivial setup** and the admin UI helps: on first save we fetch one page, infer types per column, and offer a guided drag-and-drop "warehouse field → product field" picker. The mapping persists with the config.

Caching: the adapter sends `If-None-Match` / `If-Modified-Since` if the source returned an `ETag` / `Last-Modified` previously, and a 304 ends the run with `pagesFetched: 0, status: 'succeeded'` (no work done, no version bumps).

Used as the implementation backbone for several of the common-source adapters in §2a (most are thin wrappers that pre-fill `GenericFeedConfig` for a known URL/auth shape).

## 2a. Common-source adapters (pre-staged)

The following adapters ship with the module, each one a thin wrapper that pre-fills config for the known platform shape. The operator picks the platform from a dropdown, fills in credentials, and the adapter handles pagination + field mapping. New platforms can be added without touching `InventoryService` — just add a file under `adapters/` and register it in `adapters/index.ts`.

| Adapter | Source | Auth | Pagination | Field map preset |
|---|---|---|---|---|
| `ShopifyAdapter` | `https://{shop}.myshopify.com/admin/api/2024-10/products.json` | Admin API access token (header `X-Shopify-Access-Token`) | Link-header (`rel="next"`) | Built-in. Variants → `IProductVariant[]`. Maps `inventory_quantity` → `stock`, `price` → `priceCents` (×100). |
| `WooCommerceAdapter` | `https://{site}/wp-json/wc/v3/products` | Basic (consumer key + secret) | `?page=N&per_page=100` | Built-in. Maps `regular_price` → `priceCents` (×100), `stock_quantity` → `stock`. |
| `BigCommerceAdapter` | `https://api.bigcommerce.com/stores/{hash}/v3/catalog/products` | `X-Auth-Token` header | Cursor (`meta.pagination.links.next`) | Built-in. |
| `SquareAdapter` | `https://connect.squareup.com/v2/catalog/list` | Bearer | `?cursor=` | Built-in. Filters to `CatalogObject.type='ITEM'`. |
| `NetSuiteAdapter` | SuiteQL via `/services/rest/query/v1/suiteql` | OAuth 1.0a (token + secret) | Offset+limit | Operator supplies the SuiteQL query; returns columns mapped via field map. |
| `SapBusinessOneAdapter` | Service Layer `/b1s/v1/Items` | Cookie session (login → B1SESSION) | OData `?$skip=` / `?$top=` | Built-in for the standard `Items` entity. |
| `OdooAdapter` | XML-RPC `object/execute_kw` | DB + uid + password | Domain + offset/limit | Reads `product.template` model. |
| `AirtableAdapter` | `https://api.airtable.com/v0/{base}/{table}` | Bearer | Cursor (`offset`) | Operator picks the table; field map seeded from the table's column names. |
| `GoogleSheetsAdapter` | Sheets API v4 — `spreadsheets.values.get` | Service-account JSON or OAuth | Single batch (one sheet ≤ 50k rows) | First row = headers; field map seeded from headers. |
| `CsvUrlAdapter` | Any HTTPS URL returning CSV | None / bearer / basic | None (one file = one snapshot) | Headers required; mapper guided. Thin wrapper over `GenericFeedAdapter`. |
| `JsonFeedUrlAdapter` | Any HTTPS URL returning JSON / NDJSON | None / bearer / apiKey / basic | Configurable | Thin wrapper over `GenericFeedAdapter`. |
| `PostgresAdapter` | Direct DB | Connection string | Keyset cursor | Already specified above. |
| `RestApiAdapter` | Custom REST API | Configurable | Configurable | Already specified above (kept for APIs that don't fit the generic feed shape — e.g., GraphQL endpoints, multi-call enrichment). |

### Onboarding flow (admin UI)

1. **Pick adapter** from the dropdown grouped as: *Common platforms* (Shopify / Woo / BigCommerce / Square / Airtable / Sheets) → *Generic feed* (CSV URL / JSON URL) → *Direct database* (Postgres / MSSQL) → *Enterprise* (NetSuite / SAP B1 / Odoo) → *Custom* (REST / GraphQL).
2. **Enter credentials** — adapter-specific fields. Inline `Test connection` button calls `healthCheck()`; on green, the next step unlocks.
3. **Preview a page** — adapter fetches one page and renders the first 5 rows in a table. The operator sees what the source has *before* committing to a sync.
4. **Confirm field mapping** — pre-filled for known platforms; manual / drag-to-pair for `Generic feed` adapters. Validation requires `externalId`, `title`, `priceCents`, `currency`, `stock`.
5. **Schedule** — pick a cadence (off / every 15 min / hourly / nightly / cron expression). Writes the recommended `scheduled-tasks` row.
6. **Dry-run** — final step optionally runs `syncAll({dryRun: true})` and shows the diff (would-create / would-update counts) before any DB write.

## 3. Sync orchestration

`InventoryService` is the only thing that touches the `Products` collection during a sync. It owns the run lifecycle, upsert logic, and conflict policy.

```ts
class InventoryService {
  syncAll(opts?: { dryRun?: boolean }): Promise<SyncReport>;
  syncDelta(): Promise<SyncReport>;          // since lastSuccessfulRunAt
  getStatus(): Promise<InventoryStatus>;     // last run, in-flight, lastError
  saveAdapterConfig(cfg: AdapterConfig, editedBy: string): Promise<void>;
}
```

### Run loop (per sync)

1. Insert an `InventoryRuns` document (`{ id, kind: 'all'|'delta', startedAt, status: 'running' }`) — used as a **mutex**: refuse to start if a run is already `running` and was updated in the last 30 min (older than that = crashed, allowed to take over).
2. Loop `fetchProducts(cursor)` (or `fetchProductsSince`) until `nextCursor === null`.
3. For each batch, run `mapping/fieldMap.ts` → `Product` shape, then `bulkWrite` upserts on `{ source: 'warehouse', externalId }`.
4. After each successful batch, write `lastCursor` to the run doc — enables **partial-sync recovery** (a crashed run resumes from `lastCursor`).
5. On finish, update run to `succeeded` / `failed`, write `lastSuccessfulRunAt`.
6. Fire `triggerRevalidate({ scope: 'all' })` (same precedent as commit `abee7d1` — CSV import) so storefront ISR pages rebuild.

### Upsert / conflict policy

The Products doc shape (defined in the **Products** spec) carries:

```
{ id, source, externalId, sku, title, description, priceCents, currency, stock,
  images, attributes, manualOverrides: string[], version, ...timestamps }
```

- **Upsert key**: `{ source: 'warehouse', externalId }`.
- **Warehouse-wins fields**: `priceCents`, `currency`, `stock`, `sku`, `attributes`, `updatedAt`.
- **Manual-wins fields**: `description`, `images`, `title` — *only if* the field name is in `manualOverrides[]` on the existing doc. Editors flip a per-field "lock" in the admin Products UI (defined in the Products spec). Without the lock, warehouse wins.
- **Tombstones**: a row vanishing from the warehouse is **not** auto-deleted. Instead `stock: 0, status: 'archived'` (sales history matters). Hard delete is a separate admin action.
- **Version counter**: incremented on every actual change (use `nextVersion()` from `services/infra/conflict.ts`, same as `PostService`).

### `SyncReport`

```ts
{ runId, kind, startedAt, finishedAt, durationMs,
  pagesFetched, itemsUpserted, itemsCreated, itemsUpdated, itemsArchived,
  errors: { externalId, reason }[],   // dead-letter rows; non-fatal
  status: 'succeeded'|'failed'|'partial' }
```

## 4. Scheduling

The repo has scheduled-tasks tooling (referenced via the `scheduled-tasks` MCP). Two paths:

| Trigger | In scope? | Notes |
|---|---|---|
| **Manual sync button** in admin UI | **Yes** — v1 | Hits `inventorySyncAll` / `inventorySyncDelta` mutation. |
| **Cron / scheduled-task** (e.g. `syncDelta` every 15 min) | **Yes — config-only** | Spec defines the task shape; actual scheduling is done by the operator via the existing scheduled-task console. We do NOT bake a cron into the Node process. |
| Webhook push from warehouse | **Out of scope** for v1 | Tracked as a follow-up; the adapter interface is push-compatible (just call `InventoryService.upsertOne`). |

Recommended scheduled task config (operator-set):

```
{ name: 'inventory.syncDelta', cron: '*/15 * * * *', mutation: 'inventorySyncDelta' }
{ name: 'inventory.syncAll',   cron: '0 3 * * *',    mutation: 'inventorySyncAll' }
```

## 5. Admin UI

`ui/admin/features/Inventory/InventoryPanel.tsx`:

- **Status header**: adapter id, healthCheck pill (green/red), last successful run timestamp, current state (`idle | running | failed`).
- **Run log table**: last 20 entries from `InventoryRuns` — kind, started, duration, items, status. Click row → drawer with full `SyncReport.errors`.
- **Manual sync buttons**: `Sync delta` (primary), `Sync all` (secondary, confirm dialog). Disabled while a run is in flight.
- **Adapter config form**: dropdown to pick adapter id, then adapter-specific fields (connection string for Postgres, baseUrl + authMode for REST). Field mapping table is editable as JSON for v1.

### Secrets handling

Connection strings and API keys are **secrets** and must NOT round-trip through the bundle export (`SiteBundle`) or appear in audit logs.

- Stored in `SiteSettings` under key `inventoryAdapterConfig.secret` — the admin GraphQL resolver redacts the value on read (returns `'***'` if set, real value only on a dedicated `revealSecret` mutation gated by re-auth).
- Excluded from `BundleService.export()` — explicit deny-list (same precedent as not bundling user passwords).
- For prod, prefer reading from env (`INVENTORY_PG_URL`, `INVENTORY_REST_KEY`) — config form only writes when env is unset. Document in `secrets.md`.

## 6. Authz

- All `inventory*` GraphQL operations require an authenticated **admin** user (same gate as `Bundle`, `Posts`, `Themes` — admin role check at the resolver layer).
- `revealSecret` and `saveAdapterConfig` additionally require recent re-auth (≤ 5 min since password entry) — reuse the lockout / re-auth machinery introduced in `efe6b10`.
- Every config change writes an `Audit` entry: actor, adapter id, fields changed (values redacted).

## 7. Failure handling

| Failure | Behaviour |
|---|---|
| Adapter `healthCheck` fails | Sync refuses to start. Status panel shows red + reason. |
| Network error mid-sync | Run marked `partial`. `lastCursor` retained → next `syncDelta` resumes from cursor. Backoff: 3 retries with 1 s / 4 s / 16 s delay before marking the run `failed`. |
| Single row maps badly (e.g. missing `externalId`, non-numeric price) | Row pushed to `SyncReport.errors[]` (the dead-letter list); sync continues. After 3 consecutive failed runs with the same `externalId`, row is logged to `InventoryDeadLetters` collection for manual review. |
| Concurrent sync attempt | Mutex via `InventoryRuns.status='running'`. Stale (>30 min, no heartbeat) runs are taken over. |
| Crash mid-sync | Heartbeat (`updatedAt` on the run doc, every batch). Next start sees stale run, marks it `failed`, starts fresh from `lastCursor`. |
| Warehouse returns identical doc | Upsert detects no field change → no version bump, no audit entry, not counted in `itemsUpdated`. |

## 8. Test plan

`InventoryService.test.ts` (Vitest + `mongodb-memory-server`, same pattern as `BundleService.test.ts`):

- **MockAdapter** seeded with deterministic fixtures.
- Cases:
  - `syncAll` into empty DB → N products created, all `source='warehouse'`.
  - Re-run `syncAll` with no changes → 0 updates, version unchanged.
  - Re-run with one row's `priceCents` changed → 1 update, version bumped.
  - Manual override: set `manualOverrides: ['description']` then re-sync with new description → description preserved, price still updated.
  - Adapter throws mid-stream → run status `partial`, `lastCursor` written.
  - Resume from `partial` → picks up at `lastCursor`, no duplicates.
  - `fetchProducts` returns row with missing `externalId` → row goes to dead-letter, others succeed.
  - Concurrent `syncAll` with running mutex → second call rejects with "sync in progress".
  - `healthCheck` failure → `syncAll` refuses to start.
- **Adapter unit tests**: `PostgresAdapter` against `pg-mem` or a containerised Postgres in CI; `RestApiAdapter` against `nock`-mocked HTTP.
- **No real warehouse in CI** — every test uses MockAdapter or a stand-in.

## 9. Out of scope (v1)

- Two-way sync (CMS edits flowing back to the warehouse).
- Webhook ingestion from the warehouse.
- Multi-warehouse merge (a Product with `externalId`s from two sources). The `source` field is single-valued.
- Image hosting — v1 stores remote image URLs verbatim; downloading + serving from `/api/...` is a follow-up.
- i18n of warehouse-supplied `title` / `description` — first sync pulls a single locale; translation flow is the existing CSV import.

## Open questions

With pre-staged adapters for common platforms and a config-only `GenericFeedAdapter` for arbitrary internet URLs, the *system-choice* question is no longer blocking — operators pick from the list at install time. Remaining questions are now per-deployment configuration, not implementation gates:

1. **Primary source for the launch tenant** — which adapter is the *default* (the one we test most aggressively)? Defaults the dev fixtures and the docs screenshots.
2. **Secrets storage** — env vars (preferred for prod) vs `SiteSettings` (preferred for self-service). Spec supports both; pick a default for the install template.
3. **Image rehosting** — when an adapter returns remote image URLs, do we download to `Assets` on first sync, or store the URL verbatim? Affects bandwidth + GDPR posture.
4. **Locale strategy** — single source language or multi-language at source?
5. **Manual override UX** — per-field locking (proposed) vs forking off sync entirely?
6. **Soft-delete semantics** — confirm "archive, don't delete" policy.
7. **Row identity stability** — for adapters where the source's primary key isn't obvious (CSV with no id column), can we fall back to a deterministic hash of `(sku, title)` as `externalId`?
8. **Rate limiting** — Shopify / Square / etc. publish per-shop call budgets. Should each adapter expose a token-bucket limiter, or do we rely on each platform's `Retry-After`?

### No longer blocking (resolved by the pre-staged adapter list)

- ~~Which warehouse system?~~ — operator picks from the dropdown.
- ~~Connection details / network reachability~~ — moved to a per-deployment runbook entry, not a code question.
- ~~Field mapping rules~~ — built-in presets for known platforms; guided picker for generic feeds.

---

## Implementation status

Status as of 2026-04-29: **partially shipped on `develop`** (uncommitted).

Shipped:
- `IWarehouseAdapter` interface + `MockAdapter` (dev/test default) + `GenericFeedAdapter` (JSON / NDJSON / CSV / TSV with bearer/apiKey/basic auth, all four pagination styles, ETag/Last-Modified caching).
- `InventoryService` orchestrator: `syncAll`, `syncDelta`, `getStatus`, `saveAdapterConfig`, `readDeadLetters`. Mutex via `InventoryRuns` heartbeat. Per-field `manualOverrides`-aware upsert through `ProductService.upsertFromWarehouse`. Soft-archive on missing rows. Dead-letter promotion after 3 consecutive failures. ISR revalidate after success/partial.
- Admin pane (`ui/admin/features/Inventory/Inventory.tsx`) with status header, run log, manual sync buttons, adapter config form (JSON-textarea field map for v1).
- GraphQL: `inventoryStatus`, `inventoryReadDeadLetters`, `inventorySyncAll`, `inventorySyncDelta`, `inventorySaveAdapterConfig`. Admin-gated.
- Adapter-resolution order: env `INVENTORY_ADAPTER_CONFIG` JSON > `SiteSettings.inventoryAdapterConfig` > `MockAdapter` fallback.
- 22 tests covering orchestrator + GenericFeedAdapter unit tests against fetch mocks.

Deferred:
- Platform-specific adapters (`Shopify`, `WooCommerce`, `BigCommerce`, `Square`, `Airtable`, `GoogleSheets`, `NetSuite`, `SapBusinessOne`, `Odoo`) — `GenericFeedAdapter` covers most cases; per-platform adapters are incremental adds.
- `PostgresAdapter` / `RestApiAdapter` — `GenericFeedAdapter` covers most REST cases; Postgres is a separate dep (`pg`) decision.
- `revealSecret` mutation with re-auth gate — admin form is write-only-overwrite for v1.
- Image rehosting — URLs stored verbatim.
- Guided field-mapping picker — JSON textarea for now.
- Dedicated `listRuns` query — admin pane shows `currentRun` + `lastSuccessfulRun` from `inventoryStatus`.
- Webhook ingestion + cron scheduling — operator wires via the existing scheduled-tasks console.

Files: `shared/types/IInventory.ts`, `services/features/Inventory/{InventoryService.ts,InventoryService.test.ts,adapters/{IWarehouseAdapter.ts,MockAdapter.ts,GenericFeedAdapter.ts,index.ts}}`, `services/api/client/InventoryApi.ts`, `services/api/{schema.graphql,generated/schema.generated.ts}`, `services/features/Auth/authz.ts`, `services/infra/mongoDBConnection.ts`, `ui/admin/features/Inventory/Inventory.tsx`, `ui/admin/shell/AdminSettings.tsx`.
