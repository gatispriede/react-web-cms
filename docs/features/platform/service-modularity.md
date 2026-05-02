# Service-side modularity — one folder, one feature

Status: **Phase A + B shipped 2026-04-30 → 2026-05-01.** All 18 features now own a `feature.manifest.ts`. Phase C (extract SDL fragments + authz contributions out of the shared files into manifests) is the remaining cleanup.
Last updated: 2026-05-01
Related: [plug-and-play-features.md](plug-and-play-features.md)

## Status snapshot

### Shipped (Phase A — 2026-04-30)

- `services/infra/featureManifest.ts` — `FeatureManifest` + `FeatureContext` (now includes `reconnect: () => Promise<void>`) + `FeatureIndexSpec` (with `expireAfterSeconds: number | (() => number)` thunk support) + `FeatureAuthzContribution`.
- `services/infra/featureRegistry.ts` — split into `bootFeaturesSync` (synchronous service construction, runs before constructor returns) + `bootFeaturesAsync` (indexes + onBoot). Plus `composedSchemaSDL()`, `composedResolvers()` (strict — duplicate field = boot error), `composedAuthz()`, topological `sortFeatures()` over `requires`.
- `tools/codegen-feature-registry.ts` + `npm run features:codegen[:check]` — emits `services/infra/featureRegistry.generated.ts` from sibling `feature.manifest.ts` files. Wired into `predev` + `prebuild`; CI runs `:check`.
- `MongoDBConnection` constructs every service synchronously via `bootFeaturesSync` before the constructor returns; `setupClient()` runs the async tail. `MongoDBConnection.featureServices.<id>` is the single source of truth.
- `composedResolvers()` is wired into `nextResolvers` — manifest resolver entries run live.

### Shipped (Phase B — 2026-04-30 → 2026-05-01)

All 18 features migrated. Each owns `feature.manifest.ts` + sibling `feature.manifest.test.ts`:

| Feature | Owns | Notes |
|---|---|---|
| `audit` | service | Phase A proof-of-concept |
| `cart` | service + indexes + resolvers (inline owner-based) | `requires: ['products']` |
| `products` | service + indexes | Resolvers stay on guarded `mongo` proxy (Option A) |
| `inventory` | service + indexes | `requires: ['products']`. Adapter cache deferred via thunk |
| `orders` | services (`orders` + `stockReservation`) + indexes + resolvers (guest-checkout flow) + mailer closure | `requires: ['products', 'cart']` |
| `mcp` | service + indexes | |
| `themes` | service + indexes + onBoot (`seedIfEmpty`) | |
| `languages` | services (`languages` + `translationMeta`) + indexes | Two services per folder |
| `posts` | service + indexes | |
| `footer` | service + indexes | |
| `seo` | services (`siteFlags` + `siteSeo`) + indexes | |
| `presence` | service + indexes | |
| `observability` | service (`errorLog`) + indexes | |
| `assets` | service + indexes | Two-collection ctor (logos + images) |
| `bundle` | service + indexes | |
| `publishing` | service + indexes | |
| `navigation` | service + indexes + onBoot (`warnOnGhostNavigations`) | |
| `users` | service + indexes + onBoot (admin seed; idempotency-flag preserved inside the manifest module) | |

**Visible artefact achieved:** every service is constructed by its manifest. `MongoDBConnection.setupClient` collapsed to ~10 lines: open client, run sync boot, run async tail. Legacy `new <X>Service(...)` lines are commented out as reversibility markers; Phase C removes them once SDL/authz also move.

### Phase B follow-ups landed mid-flight

- **Sync-boot race fix.** Original async-only `bootFeatures` raced HTTP requests against undefined service getters during the ~50 ms cold-boot window. Split into `bootFeaturesSync` (called before constructor returns) + `bootFeaturesAsync` (resolves `connection.ready`).
- **Stack-overflow recursion.** Manifests calling `getMongoConnection()` inside their `services` factory re-entered the still-running constructor. Fixed by adding `ctx.reconnect: () => Promise<void>` to `FeatureContext`; manifests now read it from the context, never from the singleton.
- **Inventory adapter cache deferral.** `inventoryAdapter` + `resolveInventoryAdapter` haven't migrated (still on `MongoDBConnection`). Inventory's manifest factory builds a `getAdapter` thunk that lazily `require()`s the connection at first use — boot stays clean.
- **Cart's `requires: ['products']`** flipped on the day Products' manifest landed; the legacy fallback was removed in the recursion-fix sweep.

## Phase C shipped 2026-05-01

### C.1 — consumers wired

- **`composedAuthz()` consumer.** `services/features/Auth/authz.ts` static-imports `composedAuthz` and folds every manifest's `authz` block into the legacy `MUTATION_REQUIREMENTS` / `QUERY_REQUIREMENTS` / `MUTATION_CAPABILITIES` / `SESSION_INJECTED_METHODS` / `CUSTOMER_*` / `ANON_OPEN_MUTATIONS` tables (now declared as empty literals). Existing call sites unchanged; manifest-side authz is enforced.
- **`composedSchemaSDL()` consumer.** Both `ui/client/pages/api/graphql.ts` (Next route) and `services/index.ts` (standalone build server) concatenate the composed SDL onto the legacy `services/api/schema.graphql`. Apollo accepts the combined type-defs (every manifest uses `extend type QueryMongo { … }` / `extend type MutationMongo { … }`).

### C.2 — extraction pass

19 manifests now own their SDL + authz contributions:
- 15 from the bulk migration (Audit, Observability, Assets, Footer, Inventory, Languages, Mcp, Navigation, Orders, Posts, Products, Publishing, Seo, Themes, Users)
- Cart from Phase B
- Platform (new in C.3) — owns the cross-cutting `getMongoDBUri`, `loadData`, `getFeatureFlags` queries
- Bundle + Presence have no GraphQL surface; manifests stay services-only

### C.3 — interface gaps + build path

- **`customerSessionInjected`** added to `FeatureAuthzContribution`. Users + Orders now contribute their customer-side `_session` injections via the manifest (was previously stuck in legacy `CUSTOMER_SESSION_INJECTED_METHODS`).
- **Platform manifest** owns the three platform-level queries that didn't fit any feature; `services/api/schema.graphql` is now nothing but shared `type` declarations + sentinel `_empty` fields on `QueryMongo` / `MutationMongo`.
- **Strip pass.** Legacy `schema.graphql` + `authz.ts` reduced to platform shells + empty literals. The merge layer fills the literals from manifests at module load.
- **Boot-path fixes** unearthed during e2e:
  - `mongoDBConnection.ts` switched from `require()` (CJS) to top-level static `import` of `bootFeaturesSync` / `bootFeaturesAsync` — `tsx` runs ESM and `require` is undefined there.
  - Constructor opens the Mongo client + db handles synchronously, runs `bootFeaturesSync` before returning. `setupClient` flips a `_hasOpenedClient` flag so the FIRST call (kicked by `this.ready`) runs the async tail without re-opening; reconnect calls go through close-and-reopen.
  - `services/index.ts` now reads `composedSchemaSDL()` so the standalone build server has every feature's fields.
  - `tools/e2e-build.js` mirrors `MONGODB_URI`, `INITIAL_PASSWORD_DIR` (fresh tmp), `INTERNAL_GRAPHQL_URL`, and `FEATURE_*=true` onto BOTH the standalone and the next-build subprocess so build-time gqty + gqlFetch hit the same endpoint with the same active feature set.
  - `services/features/Auth/initialPassword.ts` reads `INITIAL_PASSWORD_DIR` env override so e2e build doesn't trip on the local dev machine's stale artefact.

E2E throughout: 58 passed / 21 skipped / 0 failed in 40s.

### Remaining cleanup (C.3)

The dedup pass — once C.2 has shipped through e2e and a release cycle, remove the duplicates:

1. **Strip legacy SDL.** Each feature's lines come out of `services/api/schema.graphql`; the file shrinks to platform-level types (`IUser`, `ISection`, …) and the small set of platform queries that don't have a feature owner — `loadData`, `getMongoDBUri`, `getFeatureFlags`.
2. **Strip legacy authz tables.** Every entry already mirrored on a manifest comes out of `MUTATION_REQUIREMENTS` etc. Same set of platform-level entries stays.
3. **Drop the `// MIGRATED` reversibility comments** in `mongoDBConnection.ts`.
4. **Open shape gap — `customerSessionInjected`.** `FeatureAuthzContribution` has `sessionInjected` (admin-side) but no customer-side equivalent. Customer-injection lookups (Users' `getMe`, `updateMyProfile`, …; Orders' `myOrders`, …) currently live only in legacy `CUSTOMER_SESSION_INJECTED_METHODS`. Add `customerSessionInjected: readonly string[]` to the contribution interface, then run the missing rows through the merge layer.
5. **Open shape gap — `guardedDelegates`.** Most features go through the guarded `mongo` proxy; Cart + Orders' inline resolvers bypass it. C.3 (or D) should decide whether the manifest ships a `guardedDelegates?: Record<string, ...>` shape so a feature can declare delegate-method + scope requirements together. Surfaced by Inventory + Orders during Phase B.
6. **Customer-auth split.** `UserService` still owns admin + customer surface. Splitting off `services/features/CustomerAuth/` lands cleanly here — separate authz contributions, separate manifest, lets `customerAuth` become its own toggleable feature in plug-and-play v1.
7. **Platform feature.** `getFeatureFlags`, `loadData`, `getMongoDBUri` are platform-level reads with no natural feature owner. Carve out `services/features/Platform/` (or `Admin/`) in C.3 to take ownership. Then `schema.graphql` becomes nothing but the shared `type` declarations.

### Phase C follow-ups for the resolver layer (deferred)

- **Resolver context shape.** Cart's resolvers reach back to `getMongoConnection().cartService`; a cleaner `FeatureResolverContext` with `services` available would prevent each feature from re-doing the lookup. Land alongside C.5.
- **Plug-and-play v2 unblocked.** Now that authz + SDL ride manifest-side, disabling a feature at the registry level genuinely removes its surface (no orphan SDL, no dangling authz entries). Hot-reload (admin write-back to Mongo + re-compose without restart) is the actual v2 work; the static composition path is ready.

## What it is

Refactor `services/features/<X>/` so each folder owns *everything* server-side that the feature needs — service classes, GraphQL SDL, resolver bindings, authz contributions, Mongo index declarations, scheduled tasks. The shared infrastructure files stop hardcoding feature names and become enumerators of feature manifests instead.

The visible artefact: deleting a `services/features/<X>/` folder leaves the build green and the rest of the system functional. Today, deleting any of `Products`, `Cart`, `Inventory`, `Orders`, `Mcp` (or others) breaks compilation in five places — this spec fixes that.

## Why it matters

- Plug-and-play feature toggles (the sibling spec) need to *disable* a feature at runtime; this spec makes *removing* one a one-folder operation.
- New features can be added by dropping a folder, not by editing five shared files.
- Tests for one feature stop being coupled to the import graph of every other feature.
- AI agents (CLI / MCP) get a stable shape they can reason about: "to add a feature, write `feature.manifest.ts`."

## Where coupling lives today

These five files hardcode feature-specific knowledge. Every new feature has to edit each one:

| File | What's hardcoded |
|---|---|
| `services/infra/mongoDBConnection.ts` | Static `import` of every service class; every service constructed in the constructor; every public delegate method (`saveProduct`, `cartAddItem`, `createDraftOrder`, …) listed by name |
| `services/api/graphqlResolvers.ts` | Static `import` of every service; every resolver wired by hand; `ResolverHooks` extended per-feature |
| `services/api/schema.graphql` | Single monolithic SDL — every feature's types, queries, mutations live here |
| `services/features/Auth/authz.ts` | `MUTATION_REQUIREMENTS`, `QUERY_REQUIREMENTS`, `SESSION_INJECTED_METHODS`, `CUSTOMER_*`, `ANON_OPEN_MUTATIONS` all hardcode method names from every feature |
| `services/features/Bundle/BundleService.ts` (probably) | Bundle export/import lists every collection by name |

## The shape — module manifest

Every feature exports a `feature.manifest.ts` declaring everything it contributes:

```ts
// services/features/Cart/feature.manifest.ts
import {CartService} from './CartService';
import {cartSdl} from './graphql/cart.graphql';   // SDL string or imported file
import {cartResolvers} from './graphql/resolvers';
import {cartAuthz} from './authz';
import type {FeatureManifest} from '@services/infra/featureManifest';

export const cartFeature: FeatureManifest = {
    id: 'cart',
    displayName: 'Shopping cart',

    // Construct services from the shared db + redis. Returned record is
    // exposed to resolvers via `ctx.services.cart`.
    services: ({db, redis, deps}) => ({
        cart: new CartService(db, redis, deps.products),
    }),

    // Declare which other features must be present (build-time check).
    requires: ['products'],

    // Mongo index spec — applied on first connect.
    indexes: [
        {collection: 'Carts', spec: {customerId: 1}, options: {unique: true}},
    ],

    // GraphQL SDL fragment — stitched into the composed schema.
    schemaSDL: cartSdl,

    // Resolver tree — merged into the composed resolver map.
    resolvers: cartResolvers,

    // Authz table contributions.
    authz: cartAuthz,   // {customerMutations: ['cartAddItem', ...], anonOpen: [...], ...}

    // Optional lifecycle hooks.
    onBoot: async () => {/* warm cache, etc */},
};
```

`FeatureManifest` is a small typed interface in `services/infra/featureManifest.ts`. There is **one** such file per feature folder, alongside the existing service files.

## How it composes

A new `services/infra/featureRegistry.ts` enumerates manifests. Two options for discovery:

1. **Explicit list** — `featureRegistry.ts` imports each manifest by name. Less magic; the list is a single edit point but at least it's *one* edit point not five.
2. **Glob-based** — `import.meta.glob('../features/*/feature.manifest.ts', {eager: true})`. Truly drop-in; build tooling has to support the glob (Vitest + tsx do).

**Recommendation: explicit list for v1**, switch to glob if it becomes painful. Glob is fragile across build tools and obscures where features come from.

`MongoDBConnection` becomes a thin orchestrator:

```ts
class MongoDBConnection {
    async setupClient() {
        await connect();
        const ctx = {db: this.db, redis: this.redis, deps: {}};
        for (const feature of featureRegistry) {
            const services = feature.services(ctx);
            Object.assign(this.services, services);
            ctx.deps = this.services;   // later features see earlier ones
            await this.applyIndexes(feature.indexes);
            await feature.onBoot?.();
        }
    }
}
```

Public delegate methods (`saveProduct`, `cartAddItem`, …) disappear from `MongoDBConnection` — resolvers get the service map directly via the GraphQL context. The current `mongoDBConnection.cartAddItem(...)` call sites change to `ctx.services.cart.addItem(...)`.

`graphqlResolvers.ts` becomes:

```ts
const composed = composeResolvers(featureRegistry.map(f => f.resolvers));
const composedSDL = featureRegistry.map(f => f.schemaSDL).join('\n');
```

`authz.ts` exposes a contribution API:

```ts
export function buildAuthzTables(features: FeatureManifest[]): AuthzTables {
    const tables = createEmptyTables();
    for (const f of features) {
        if (f.authz) mergeAuthzContribution(tables, f.authz);
    }
    return tables;
}
```

`guardMethods` reads the merged tables; the hardcoded ones live in `services/features/Core/feature.manifest.ts` (the always-on baseline of Auth/Users/Sections/Navigation/Themes/Languages/Bundle/Audit/Publishing).

## Dependency contract

Some features depend on others — checkout depends on cart depends on products. The manifest's `requires` field declares this; `featureRegistry.ts` topologically sorts and rejects cycles. A missing `requires` (e.g. `checkout` present but `products` missing) is a startup error, not a silent half-state.

This same `requires` graph is what plug-and-play feature toggles use to validate "can I disable products?" → "no, cart and checkout depend on it."

## Migration plan

Per-feature, smallest first:

1. **Audit** (smallest service) — extract `Audit/feature.manifest.ts`, move SDL fragment, move resolvers, remove from the five shared files. Land. Tests still green.
2. **Cart** — has the cleanest boundaries.
3. **Products** — breaks the seal on the bigger features.
4. **Inventory** — depends on Products; manifest `requires` exercised.
5. **Orders** — depends on Products + Cart.
6. **Mcp** (or `CmsAi` post-redesign) — admin-ui touch point.
7. **Customer auth surface** — splits between `Users` core and a new `CustomerAuth` feature.
8. **Core CMS** (Sections, Navigation, Themes, Languages, Posts, Bundle, Publishing, Footer, Seo, Assets) — bundle into a `Core` feature manifest that's always present.

Each step lands with the suite green; the old static imports stay until the manifest path is proven, then deleted in the same PR.

## What this does NOT solve

- **Public Next.js pages** (`ui/client/pages/products/`, `/cart`, `/checkout`, …) stay in the file-based router. The manifest doesn't move them. Plug-and-play disables their route via `notFound: true`; literal file removal is a separate Next App Router migration concern.
- **Admin UI panes** (`ui/admin/features/<X>/`) live in the UI tree, not under `services/features/`. The `admin-ui-modes.md` spec already describes a `AdminPaneDescriptor` registry — that's the UI-side analogue of this spec.
- **Shared types** (`shared/types/IProduct.ts`, etc.) stay in `shared/types/` because cart imports product types and vice versa. Co-locating them under feature folders would require a circular-import break we don't want to do.

## Out of scope (v1)

- Hot-reload of features at runtime. Adding/removing a manifest still needs a server restart.
- Per-feature versioning / migrations. Mongo schema changes still ride the existing pattern.
- Marketplace / third-party feature plugins. The manifest shape is designed to allow this later but we're not building a plugin loader now.

## Open questions

1. **Resolver merging strategy** — `composeResolvers` needs a deterministic merge. Two features both adding to `MutationMongo` is fine; two features both defining the same field is a startup error. Pick a small dependency-free merge helper or roll our own (~30 LOC).
2. **SDL stitching** — concatenating SDL strings works for additive cases. Field extension across features (e.g. inventory adding fields to a `Product` type defined in products) needs `extend type Product { ... }` syntax. Confirm GraphQL-tools is fine with naive concat (it is, as long as `extend` is used correctly).
3. **`ResolverHooks` per feature** — today `graphqlResolvers.ts` extends `ResolverHooks` with per-feature additions (`getCartCookieId`, `setOrderTokenCookie`, `rateLimitSignup`). The manifest should let a feature declare its required hooks; the GraphQL handler in `ui/client/pages/api/graphql.ts` composes them.
4. **Test fixtures** — `feature.manifest.test.ts` per folder asserts the manifest is internally consistent (declared SDL types match resolver fields, declared methods exist on services). Cheap insurance.
5. **Glob vs explicit** — re-evaluate after migrating 3 features. If the explicit list is friction-free, keep it.
6. **Customer auth boundary** — currently customer-auth lives across `Users`, `Auth/authz.ts`, and `ui/client/pages/account/`. Splitting it into its own feature manifest is more invasive than the others. Could ship as a manifest-less "core extension" first, then split later.
