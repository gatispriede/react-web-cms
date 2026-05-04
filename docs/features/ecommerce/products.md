# Products module

Status: design / not yet implemented
Last updated: 2026-04-29
Owner: e-commerce track
Related: ../core/blog.md, ../core/content-management.md, ./inventory-warehouse.md

## 1. Overview

The Products module introduces the first commerce-shaped content type to the
CMS. It mirrors the existing Posts/Themes/Navigation module shape exactly:

- Mongo collection (`Products`)
- Service class under `services/features/Products/ProductService.ts`
- Resolvers wired into `services/api/graphqlResolvers.ts`
- GraphQL schema additions in `services/api/schema.graphql`
- Admin client API in `services/api/client/ProductApi.ts`
- Admin UI under `ui/admin/features/Products/Products.tsx`
- Public client pages under `ui/client/pages/products/`
- Tests with `mongodb-memory-server` (mirrors `NavigationService.test.ts`,
  `ThemeService.test.ts`)
- Authz wired through `guardMethods` in `services/features/Auth/authz.ts`

A separate **warehouse adapter** spec defines how external inventory is
synced into this collection. Products written by the warehouse adapter are
marked `source: 'warehouse'` and warehouse-sourced fields are treated as
authoritative on each sync (see Section 9).

## 2. Data model — Mongo collection `Products`

Collection: `Products`. Each document follows the same `id` (guid) +
`version` (optimistic concurrency) shape as `Posts`/`Themes`.

| Field         | Type                                | Notes / justification |
|---------------|-------------------------------------|-----------------------|
| `id`          | `string` (guid)                     | Primary key, matches `IPost.id`. Stable across slug changes. |
| `sku`         | `string`                            | Merchant-facing stock code. Unique index. Used as the join key with the warehouse. |
| `title`       | `string`                            | Display name. Required. Same role as `IPost.title`. |
| `slug`        | `string`                            | URL slug. Unique. Generated via the same `slugify` helper used in `PostService` (lowercased, ≤80 chars, collision suffix `-<ts36>`). |
| `description` | `string` (markdown / rich text)     | Long-form copy. Same role as `IPost.body`. |
| `price`       | `number` (minor units, integer)     | Stored as cents/öre/minor units to avoid float drift. UI formats with `currency`. |
| `currency`    | `string` (ISO 4217, 3 chars)        | E.g. `EUR`, `USD`. Required. Multi-currency stays out of v1 — single price per product. |
| `stock`       | `number` (integer, ≥0)              | Available units. Authoritative from warehouse when `source = 'warehouse'`. |
| `images`      | `string[]` (asset ids or URLs)      | Ordered list. First entry is the cover. Reuses the existing `Assets` feature for uploads. |
| `categories`  | `string[]`                          | Free-form tags for filtering / nav. Mirrors `IPost.tags`. |
| `attributes`  | `Record<string, string>`            | Spec sheet (e.g. `{material: 'oak', weight: '3kg'}`). Schemaless to keep the merchant flexible without migrations. |
| `variants`    | `IProductVariant[]`                 | Optional. See sub-shape below. Empty array for single-SKU products. |
| `source`      | `'manual' \| 'warehouse'`           | Provenance flag. `'manual'` items are admin-edited; `'warehouse'` items are owned by the sync job. |
| `externalId`  | `string \| undefined`               | The warehouse's primary key. Indexed. Required when `source = 'warehouse'`. |
| `draft`       | `boolean`                           | Hides product from public listing — same semantics as `IPost.draft`. |
| `publishedAt` | `string` (ISO) \| `undefined`       | Stamped on first publish (`draft` → `false`), same as `PostService.save`. |
| `createdAt`   | `string` (ISO)                      | Standard. |
| `updatedAt`   | `string` (ISO)                      | Standard. |
| `version`     | `number`                            | Optimistic concurrency, used with `requireVersion`/`nextVersion` from `services/infra/conflict.ts`. |
| `editedBy`    | `string` (email)                    | Set by the `guardMethods` proxy via `_session` injection. |
| `editedAt`    | `string` (ISO)                      | As `IPost.editedAt`. |

`IProductVariant`:

```ts
interface IProductVariant {
  id: string;          // guid, stable across edits
  sku: string;         // child SKU
  title: string;       // e.g. "Large / Red"
  price?: number;      // overrides parent price when set
  stock: number;
  attributes: Record<string, string>; // e.g. {size: 'L', color: 'red'}
}
```

Indexes:
- `{ id: 1 }` unique
- `{ slug: 1 }` unique
- `{ sku: 1 }` unique
- `{ externalId: 1 }` unique sparse (only set when `source = 'warehouse'`)
- `{ categories: 1 }` for filtered list queries
- `{ draft: 1, publishedAt: -1 }` for the public list query

Interfaces live in `shared/types/IProduct.ts` and export `IProduct`,
`IProductVariant`, `InProduct` (input shape), matching the
`IPost` / `InPost` split in `shared/types/IPost.ts`.

## 3. Service interface — `ProductService`

File: `services/features/Products/ProductService.ts`

Exact shape mirrors `PostService` — same constructor, same `normalize`
helper, same `requireVersion`/`nextVersion` usage, same slug
collision-bump strategy.

```ts
export class ProductService {
  private products: Collection;

  constructor(db: Db) {
    this.products = db.collection('Products');
  }

  // Public reads
  list(opts?: {
    includeDrafts?: boolean;
    limit?: number;
    category?: string;
    inStockOnly?: boolean;
    source?: 'manual' | 'warehouse';
  }): Promise<IProduct[]>;

  getBySlug(slug: string, opts?: {includeDrafts?: boolean}): Promise<IProduct | null>;
  getById(id: string): Promise<IProduct | null>;
  getBySku(sku: string): Promise<IProduct | null>;

  search(q: string, opts?: {limit?: number; includeDrafts?: boolean}): Promise<IProduct[]>;

  // Admin writes
  save(product: InProduct, editedBy?: string, expectedVersion?: number | null):
    Promise<{id: string; version: number; slug: string}>;

  remove(id: string, deletedBy?: string):
    Promise<{id: string; deleted: number; deletedBy?: string}>;

  setPublished(id: string, publish: boolean, editedBy?: string):
    Promise<{id: string; draft: boolean}>;

  // Warehouse-adapter entry point (called by the adapter's sync job, not
  // exposed via GraphQL). Upserts on (source='warehouse', externalId) and
  // overwrites warehouse-authoritative fields (price, stock, images, sku,
  // attributes, variants). Manual fields (categories, slug, description
  // overrides) are preserved if the doc already exists.
  upsertFromWarehouse(input: WarehouseProductInput):
    Promise<{id: string; version: number; created: boolean}>;
}
```

Behavioral parity with `PostService`:
- `save` uses the same `slugify(title)`, the same self-exclusion pattern
  for collision detection (`selfId ? {slug, id: {$ne: selfId}} : {slug}`),
  and the same `-<Date.now().toString(36)>` suffix on collision.
- `save` calls `requireVersion(existing, existingVersion, expectedVersion, 'Product "<title>"')`.
- `setPublished` flips `draft` and stamps `publishedAt` on first publish.
- `normalize` returns a fully-defaulted `IProduct` with `tags`/`images`/`variants`
  always arrays (defensive against partial docs).

`upsertFromWarehouse` rules:
- Match by `{source: 'warehouse', externalId}`.
- On insert: full doc, `source = 'warehouse'`, `draft = true` by default.
- On update: `$set` only the warehouse-authoritative fields, never touch
  `slug`, `categories`, `description` (admin-curated), or `draft`.
- Bumps `version` and stamps `editedBy = 'warehouse-adapter'`.

## 4. GraphQL — exact additions

### `services/api/schema.graphql`

Add to `type QueryMongo`:

```graphql
getProducts(
  includeDrafts: Boolean,
  limit: Int,
  category: String,
  inStockOnly: Boolean,
  source: String
): String!
getProduct(slug: String!, includeDrafts: Boolean): String
searchProducts(q: String!, limit: Int, includeDrafts: Boolean): String!
```

Add to `type MutationMongo`:

```graphql
saveProduct(product: JSON!, expectedVersion: Int): String!
deleteProduct(id: String!): String!
setProductPublished(id: String!, publish: Boolean!): String!
```

Returns are stringified JSON, matching the `getPosts` / `savePost` /
`getThemes` convention in this codebase (the `String!` payloads are
parsed client-side in `ProductApi.ts`).

### `services/api/graphqlResolvers.ts`

- Instantiate `new ProductService(db)` alongside the other services.
- Wrap with `guardMethods(productService, session, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES)`.
- Register resolvers `getProducts`, `getProduct`, `searchProducts`,
  `saveProduct`, `deleteProduct`, `setProductPublished` returning
  `JSON.stringify(...)` of service results.

### `services/features/Auth/authz.ts`

Add to `MUTATION_REQUIREMENTS`:

```ts
saveProduct: 'admin',
deleteProduct: 'admin',
setProductPublished: 'admin',
```

Add to `SESSION_INJECTED_METHODS`:

```ts
'saveProduct',
'deleteProduct',
'setProductPublished',
```

### `services/api/client/ProductApi.ts`

Mirrors `PostApi.ts` 1:1: `list`, `getBySlug`, `save`, `remove`,
`setPublished`. Calls `triggerRevalidate({scope: 'product', slug})` and
`{scope: 'products'}` for the index — extend `triggerRevalidate`'s
`scope` union to include `'product' | 'products'`.

## 5. Admin UI

File: `ui/admin/features/Products/Products.tsx` (single shell file, same
as `Posts.tsx`).

Sub-views (rendered as panes inside `Products.tsx`, matching the Posts
admin pattern):
- **List pane** — table of products (title, sku, price, stock, source,
  draft badge), filter by category, search box (calls `searchProducts`),
  "New product" button. `source: 'warehouse'` rows get a small badge and
  an inline tooltip "synced from warehouse — some fields are read-only".
- **Edit pane** — form with title, slug (auto-generated, editable),
  description (markdown editor — reuse the editor used by `Posts.tsx`),
  price + currency, stock, categories (chips), attributes (key/value
  rows), variants (sub-table), images (drag-reorder list using the
  existing `Assets` picker from `ui/admin/features/...`), draft toggle.
  When `source === 'warehouse'`, fields owned by the adapter (price,
  stock, sku, images, attributes, variants) render disabled with the
  tooltip above; categories / description / slug stay editable.
- **Image management** — reuses the `saveImage` / `deleteImage` /
  `getImages` mutations already present in `MutationMongo` (no new
  asset code needed). The product's `images: string[]` stores the asset
  ids returned by `saveImage`.

Conflict handling, version bumping, `triggerRevalidate` calls, and the
`refreshBus.emit('settings')` pattern all follow `Posts.tsx`.

## 6. Public client UI

Pages under `ui/client/pages/products/` (mirrors `ui/client/pages/blog/`):

- `index.tsx` — `/products`. Lists published, in-stock-or-not products
  with pagination/filter. Server-side fetched via `ProductApi.list`
  using the same `getStaticProps` + ISR shape `blog/index.tsx` uses.
- `[slug].tsx` — `/products/[slug]`. Renders one product: gallery
  (`images[]`), title, price (`Intl.NumberFormat` with `currency`),
  description (markdown), attributes table, variant picker (only when
  `variants.length > 0`), "out of stock" state when `stock === 0`. ISR
  via `getStaticPaths` + `getStaticProps` matching `blog/[slug].tsx`.

`triggerRevalidate({scope: 'product', slug})` and
`triggerRevalidate({scope: 'products'})` map to these two routes inside
the existing revalidate handler.

No checkout in v1 — that's a separate Cart/Checkout module. The product
page exposes a placeholder "Add to cart" button wired to a no-op
`onAddToCart` prop so the cart module can drop in later without UI
changes.

## 7. i18n

Two strategies are available; the spec picks (b):

(a) **Per-doc translations** — store `title` / `description` as
`Record<localeCode, string>`. Rejected: doesn't fit the warehouse-sync
flow (warehouse sends one canonical title, not a localised map) and
diverges from how Posts handle copy today.

(b) **CSV translation overlay** (chosen) — store the canonical
`title` / `description` in the source locale on the doc, and route
display strings through the existing `next-i18next` + CSV translation
editor. Each product gets two translation keys:

- `product.<slug>.title`
- `product.<slug>.description`

The admin "Edit" pane gets a "Translations" sub-tab that opens the
existing CSV editor pre-filtered to those two keys. On save, if the
slug is renamed, the keys are migrated alongside (the CSV editor's
existing rename utility, same as Posts uses for `post.<slug>.*`).

Public `/products/[slug]` resolves the title/description through
`useTranslation('products')` with the canonical doc value as the
fallback when no override exists for the active locale.

Currency-formatted prices use the locale's `Intl.NumberFormat` — no
translation key needed.

## 8. Test plan

File: `services/features/Products/ProductService.test.ts`, using
`mongodb-memory-server` (same setup as `NavigationService.test.ts` and
`ThemeService.test.ts`).

Coverage:
1. `save` creates a product, generates slug from title, stamps
   `createdAt` / `updatedAt` / `version=1`.
2. `save` with existing `id` bumps `version`, calls `requireVersion`,
   throws on stale `expectedVersion`.
3. Slug collision bumps with `-<ts36>` suffix; self-update keeps slug.
4. `getBySlug` filters drafts unless `includeDrafts: true`.
5. `getBySku` returns by sku.
6. `list` filters by `category`, `inStockOnly`, `source`.
7. `search` matches on title/sku case-insensitively.
8. `remove` deletes by id.
9. `setPublished` flips draft, stamps `publishedAt` on first publish only.
10. `upsertFromWarehouse`:
    - Inserts a new doc with `source='warehouse'`, `draft=true`, sets
      `externalId`.
    - Re-running with same `externalId` updates price/stock/images but
      preserves admin-edited `categories` and `description`.
    - Stamps `editedBy: 'warehouse-adapter'`.
11. Authz: a `guardMethods`-wrapped service throws `AuthzError` on
    `saveProduct` for an `editor` session and succeeds for `admin`
    (mirrors `authz.test.ts`).

Public-side: a smoke test for `/products` and `/products/[slug]`
rendering with a seeded product (Vitest + RTL, same as the blog page
tests).

## 9. Interaction with the warehouse adapter

- The adapter calls `ProductService.upsertFromWarehouse` directly (not
  through GraphQL) on its sync schedule.
- Field ownership matrix:

  | Field         | Owner when `source='warehouse'` |
  |---------------|---------------------------------|
  | sku, price, stock, images, attributes, variants, externalId | warehouse (overwritten on each sync) |
  | title         | warehouse on insert, manual override allowed (sticky) |
  | description   | manual (preserved) |
  | slug          | derived once on insert, never re-derived |
  | categories    | manual |
  | draft         | manual (defaults to `true` on first insert so a human reviews before publish) |

- Deletes from the warehouse are **soft** in v1: the adapter calls
  `setPublished(id, false)` rather than `remove`, so an admin can
  decide to fully delete. Open question 3 below.

## 10. Open questions

1. **Single price vs price-per-currency.** v1 stores one `price` +
   `currency`. Multi-currency would need either a `prices: Record<ISO, number>`
   map or a separate `Prices` collection.
2. **Stock semantics for variants.** When `variants[]` is non-empty, is
   the parent `stock` ignored, or is it `sum(variants[].stock)`?
3. **Warehouse "delete" handling.** Soft-unpublish (current spec) vs
   hard delete.
4. **Search backend.** v1 uses Mongo regex on title/sku — fine for
   small catalogs (<10k). At scale, Atlas Search or a dedicated index
   is needed.
5. **Slug stability when warehouse renames a title.** Spec keeps the
   slug stable across syncs (good for SEO). Confirm.
6. **Cart / checkout boundary.** Cart module needs to define how it
   reads product price at checkout time (snapshot vs live re-fetch).
7. **Image storage for warehouse-sourced URLs.** Download into Assets
   or store external URLs as-is in `images[]`?
8. **Admin permission level.** Spec defaults to `admin` per the user
   requirement, but Posts use `editor`. Confirm or downgrade.

---

## Implementation status

Status as of 2026-04-29: **shipped on `develop`** (uncommitted).

Implemented per spec. Decisions taken:
- Mongo regex search on title/sku (Q4) — fine for v1 catalogues <10k.
- `externalId` omitted (not stored as `null`) for non-warehouse rows so the sparse unique index doesn't collide.
- `manualOverrides` field-pinning baked in now to avoid retrofit when inventory consumed it.
- Variant stock owns at runtime when `variants[]` non-empty (Q2).
- Slug stable across warehouse title renames (Q5).
- Admin permission `'admin'` per the spec default (Q8).

Deferred:
- Admin "Translations" sub-tab pre-filtered to `product.<slug>.*` keys — public-side `useTranslation` fallback works; admin sub-tab is a follow-up.
- gqty schema regeneration — `ProductApi.ts` uses the `(query as any).mongo.…` cast pattern (matches `PostApi.ts`).

Files: `shared/types/IProduct.ts`, `services/features/Products/{ProductService.ts,ProductService.test.ts}`, `services/api/{schema.graphql,client/ProductApi.ts}`, `services/infra/mongoDBConnection.ts`, `services/features/Auth/authz.ts`, `ui/admin/features/Products/Products.tsx`, `ui/admin/shell/AdminSettings.tsx`, `ui/client/lib/triggerRevalidate.ts`, `ui/client/pages/api/revalidate.ts`, `ui/client/pages/products/{index.tsx,[slug].tsx}`. Tests: 13 new.
