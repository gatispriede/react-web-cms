# Plug-and-play feature toggles

Status: **v2 shipped 2026-05-01.** v1 (env-driven + read-only admin) + v2 (Mongo persistence, admin write-back, public-route 404 gating, MCP write tools).
Last updated: 2026-05-01

## Shipped (v1 + v2)

### Manifest contract

- `FeatureManifest.enabled?: boolean | (() => boolean)` — declarative toggle.
- `FeatureManifest.coreInfrastructure?: boolean` — locks the toggle off; core baseline can't be disabled.

### Resolution stack (`services/infra/featureFlags.ts`)

Precedence, highest wins:
1. **Env var** `FEATURE_<UPPER>` set to `true|false|on|off|1|0` — operator-pinned, sticky across restarts.
2. **Mongo override** — written via `setFeatureFlag` (admin UI / MCP), persisted in `FeatureFlags` collection, primed into a sync cache by the `featureFlags` manifest's `onBoot`.
3. **Per-feature default** — products / cart / inventory / orders / mcp = OFF; everything else = ON; `coreInfrastructure: true` ignores all of the above.

### Persistence

`services/features/FeatureFlags/FeatureFlagsService.ts` + `feature.manifest.ts` — one row per overridden feature `{id, enabled, updatedAt, updatedBy}`, unique index on `id`. The `featureFlags` manifest is `coreInfrastructure: true` so the operator can never lock themselves out of toggling.

### Registry skip + dependency cascade

`activeFeatures()` filters by `resolveEnabled(manifest)` AND auto-disables anything whose `requires` chain dropped. Disable cart → checkout/orders cascade off. Each cascade is logged as `feature.flag.cascade`.

### Admin surface

- `/admin/system/features` — editable AntD table.
- `Switch` per non-core, non-env-pinned row (env-pinned rows render disabled with the env-key chip).
- `Reset to default` button drops a Mongo override.
- `Source` column shows `core (locked)` / `env: FEATURE_FOO` / `admin override` / `default` so the operator sees why a row resolves the way it does.
- Banner on the page warns: "runtime gates pick up the change immediately; boot-side schema/services need a restart to fully reappear."

### GraphQL

| Operation | Scope |
|---|---|
| `mongo.getFeatureFlags: String!` | admin |
| `mongo.setFeatureFlag(id, enabled): String!` | admin (session-injected for audit-trail) |
| `mongo.clearFeatureFlag(id): String!` | admin (session-injected) |

Payload shape includes `envSet: boolean` and `mongoOverride: boolean` so the admin UI + MCP can render the source breakdown.

### MCP tools

- `site.featureFlags` (scope `read:site`) — runtime view.
- `site.setFeatureFlag` (scope `write:site`) — persist override.
- `site.clearFeatureFlag` (scope `write:site`) — drop override.

### Public-route 404 gating

`ui/client/lib/featureGate.ts` exports `withFeatureGate(featureId, inner?)` and `withFeatureGatePaths(featureId, inner)`. Wraps `getStaticProps` / `getServerSideProps` / `getStaticPaths`; returns `{notFound: true}` (or empty paths) when the feature is off. Applied to:

- `/products`, `/products/[slug]` — both `getStaticProps` and `getStaticPaths`.
- `/cart` — `getServerSideProps` (page is otherwise client-rendered).
- `/checkout` — `getServerSideProps` (gated on `orders`).

A hand-typed URL or a stale link 404s end-to-end when the feature is off, with no half-render or empty-state leak.

### Audit

Every `setFeatureFlag` / `clearFeatureFlag` write goes through the standard `runMutation` audit path, stamped with the actor email (or `mcp:<token-id>`).

## Lifecycle nuance — boot-side vs runtime

Two layers of gating coexist:

- **Boot-side** — the registry's `activeFeatures()` skips disabled features at boot, so their services aren't constructed, their SDL doesn't compose, their resolvers don't bind. Flipping a flag from off → on through the UI does NOT bring those back; a server restart is required.
- **Runtime** — `isFeatureEnabled(id)` consults the live Mongo cache on every call. Route gates, GraphQL guards, and any `if (!isFeatureEnabled(...)) throw` checks pick up flips immediately for the next request.

The combination gives operators useful runtime control (404 a public route, refuse a mutation) without paying the complexity cost of dynamic schema swaps. v3 (true hot-reload of services + schema + resolvers) is deferred — would require Apollo's gateway/federation primitives to swap typeDefs without bouncing the process.

## What's NOT in v2

- Hot-reload of services / schema / resolvers — disabled-at-boot features stay missing from the schema until restart.
- Per-tenant flags — single-tenant repo.
- Data purge on disable — disabling Products hides the route + the API; the `Products` collection survives. Explicit purge is a separate operator action.
