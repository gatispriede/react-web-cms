# Service-side modularity — one folder, one feature

Status: Planned
Last updated: 2026-04-29
Related: [plug-and-play-features.md](plug-and-play-features.md)

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
