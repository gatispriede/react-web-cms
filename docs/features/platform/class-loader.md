# Class Loader — unified service + UI module loading

Status: **L1 + L2 + L3 + L4 shipped 2026-05-02.** All 22 features migrated to ServiceLoader subclasses; manifests are 2-line re-exports. **L4 complete**: `adminUILoaderRegistry.ts` collects 17 `AdminUILoader` subclasses (one per admin pane). `UserStatusBar.renderPane()` consults the registry first via `findAdminPaneById()` and falls back to a single inline case (`system/features` — kept inline because FeatureFlagsPanel hosts the restart banner). Mode-aware dispatch picks `modes.simplified ?? modes.advanced` based on `useAdminMode()`. **Remaining L4 follow-ups**: ClientUILoader public-route discovery (auto-apply `withFeatureGate`), item-types feature-by-feature migration off `ui/admin/lib/itemTypes/registry.ts`. Supersedes the standalone `guardedDelegates` question and the ad-hoc admin-pane registry.
Last updated: 2026-05-02

## Why a Loader

Today three different mechanisms coexist:

1. **`featureRegistry.ts`** — boots services, composes SDL, composes resolvers, composes authz. Reads `feature.manifest.ts`.
2. **Guarded `mongo` proxy** — wraps delegate methods on `MongoDBConnection` with `guardMethods` (role / capability / session-injection). Authz tables live in `services/features/Auth/authz.ts` (now filled by `composedAuthz()` from manifests).
3. **UI registries** — `ui/admin/lib/itemTypes/registry.ts` (module item types), feature pane descriptors (TBD per `admin-ui-modes.md`), MCP tool registry, etc.

Each has its own conventions. New features have to remember to register in three places. The **Loader** abstraction unifies them under one contract that spans the backend service layer and the frontend UI layer.

## Class hierarchy (decision 2026-05-02)

The Loader hierarchy mirrors folder architecture:

```
Loader (abstract)
├── ServiceLoader               ← services/features/<Feature>/
│   └── feature-specific subclass per backend feature
└── UILoader (abstract)
    ├── ClientUILoader          ← ui/client/modules/<Feature>/  (public site renderer)
    │                             ui/client/features/<Feature>/ (feature-level public surface)
    └── AdminUILoader           ← ui/admin/modules/<Feature>/   (admin editor)
                                  ui/admin/features/<Feature>/  (feature-level admin surface)
```

A feature owns up to three concrete subclasses — one per relevant folder:

- `ProductsServiceLoader` under `services/features/Products/`.
- `ProductsClientUILoader` under `ui/client/modules/Products/` (or `ui/client/features/Products/` for non-module surfaces like `/products` index).
- `ProductsAdminUILoader` under `ui/admin/modules/Products/` (editor) plus `ui/admin/features/Products/` (admin pane).

**Integration via inheritance** — each concrete subclass extends its abstract base. The codegen registry collects subclasses by static scan of the folder tree; no manual registration.

**Why split client vs admin UI loaders** — server boot must skip the admin UI side entirely (no AntD imports in the public bundle), and the public bundle must skip admin imports. Hierarchy enforces the bundle boundary at the type level.

## Two halves of one abstraction

### Backend `ServiceLoader`

Owns "when to load and how to gate":

- **Order** — topological sort over `requires` (already in featureRegistry).
- **Security** — declares which delegate methods are guarded, with `{role, capabilities, sessionInjected, customerSessionInjected}` per method. Replaces the standalone `guardedDelegates` idea — the Loader is the single source of truth.
- **When to load** — feature-flag resolution (env > Mongo > default), `coreInfrastructure` lock, `requires` cascade. All already in `featureFlags.ts`; the Loader wires it as a single decision per feature.
- **Service construction** — sync vs async, `onBoot` indexes, reconnect handling. Already in `bootFeaturesSync` / `bootFeaturesAsync`.

The contract a feature implements becomes:

```ts
class ProductsLoader extends ServiceLoader {
  id = 'products';
  requires = [];
  defaultEnabled = false;

  buildServices(ctx) { return {products: new ProductService(ctx.db)}; }
  indexes() { return [/* ... */]; }
  guarded() {
    return {
      getProducts:        {role: 'public'},
      saveProduct:        {role: 'admin', sessionInjected: true},
      deleteProduct:      {role: 'admin', sessionInjected: true},
      setProductPublished:{role: 'admin', sessionInjected: true},
    };
  }
  schemaSDL() { return `...`; }
}
```

`featureRegistry` becomes a list of `ServiceLoader` instances; `composedAuthz()` reads `loader.guarded()` instead of the manifest's `authz` literal block.

### Frontend `UILoader` (subclass)

Owns "how the feature appears in the admin and on the public site":

- **Admin pane** — declarative `{id, title, icon, route, modes: {simplified, advanced}}` (ties into `admin-ui-modes.md`).
- **Item types** — module renderers + editors registered through the loader instead of a separate flat array (current `itemTypes/registry.ts`).
- **Public routes** — `withFeatureGate` wiring auto-applied based on the loader's id.
- **MCP tools** — declared on the loader; `mcp.featureFlags`/etc. read from the registry.
- **i18n namespaces** — feature owns its translation keys; loader registers them with the i18n boot.

```ts
class ProductsUILoader extends ProductsLoader implements UILoader {
  adminPane = {
    id: 'products',
    title: 'Products',
    icon: ProductIcon,
    route: '/admin/content/products',
    modes: {
      simplified: ProductsSimplifiedView,
      advanced: ProductsAdvancedView,
    },
  };
  itemTypes = []; // none for products
  publicRoutes = [{path: '/products', gate: 'products'}];
  mcpTools = [/* ... */];
}
```

A feature ships **one Loader class** that the registry consumes for both backend boot and frontend mounting. No more "remember to add it to the admin sidebar AND the feature manifest AND the authz table."

## L4 decisions (2026-05-02)

- **Item-types migration: feature-by-feature.** The flat `ui/admin/lib/itemTypes/registry.ts` array stays as the discovery surface; one feature at a time gets a `<Feature>ClientUILoader` (display) + `<Feature>AdminUILoader` (editor) pair, and its row is removed from the flat registry. The flat registry becomes empty over time, then deletes. No big-bang rewrite, no two-week refactor freeze.
- **Legacy literal-manifest convention: keep for now.** `feature.manifest.ts` stays as the codegen-discovery surface (already a thin `new …ServiceLoader().toManifest()` re-export, two lines). Codegen scanning is unchanged. Drop the convention only if/when codegen evolves to scan `*ServiceLoader.ts` directly — small win, high disruption to defer.

## Migration

Existing manifests → Loaders is a mechanical rewrite. The current `feature.manifest.ts` becomes a Loader subclass. Codegen (`tools/codegen-feature-registry.ts`) adapts to emit Loader imports. Phase-by-phase:

1. **L1 — Loader base classes.** Define `ServiceLoader` (and `UILoader extends ServiceLoader`) under `services/infra/`. Compatibility shim so existing manifests still work.
2. **L2 — Migrate one feature** (Products is the cleanest test case) and prove SDL/authz/services/admin pane all wire from one class.
3. **L3 — Bulk migrate** the other 18 features.
4. **L4 — Drop the legacy manifest contract** + the standalone `itemTypes/registry.ts` / sidebar-registration / authz-block paths.

## Open questions

1. **Class vs object literal** — TS classes give inheritance (ProductsUILoader extends ProductsLoader → backend tests don't drag in the UI side). Object literals are flatter but lose the inheritance hook. Default: classes.
2. **Where does the Loader register?** Codegen scans for `*Loader.ts` and emits a generated import list, mirroring today's `feature.manifest.ts` discovery.
3. **Backwards compatibility shim** — keep manifest-style features booting until L4. Compatibility cost is one adapter file in `featureRegistry`.
4. **Frontend bundle splitting** — the UILoader is imported on the admin client only. Server boot must skip the UI half entirely (no React imports in the Node graph). Tooling: separate entry for the `ServiceLoader` half so the codegen for backend doesn't pull in `ui/`.
5. **Hot-reload story** — when paired with `server-restart.md`, the Loader registry could in theory unload + reload a single feature class. Out of scope for v1; flag as a v3 capability.

## Relationship to other roadmap items

- **Subsumes**: service-modularity backlog "guardedDelegates shape", ad-hoc admin-pane registry referenced in `admin-ui-modes.md`.
- **Complements**: `plug-and-play-features.md` (Loader is the carrier for `enabled` / `coreInfrastructure` / `requires`); `server-restart.md` (Loader registry is what re-runs on boot).
- **Does NOT replace**: the runtime feature-flag service, the audit pipeline, the guarded proxy itself — only how features *declare* their participation in those systems.
