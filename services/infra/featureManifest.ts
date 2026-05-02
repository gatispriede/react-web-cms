import type {Db} from 'mongodb';
import type {RedisLike} from './redis';

/**
 * Per-feature manifest — one of these lives at
 * `services/features/<X>/feature.manifest.ts` and declares everything
 * the feature contributes to the running CMS:
 *
 *   - service classes (constructed lazily so the manifest itself can be
 *     imported without spinning up Mongo connections)
 *   - GraphQL SDL fragment (stitched into the composed schema at boot)
 *   - resolver tree (merged into the composed resolver map)
 *   - authz contributions (mutation/query requirements, scope grants,
 *     anonymous-allow lists)
 *   - Mongo indexes to ensure on first connect
 *   - dependency edges (`requires`) — startup fails if a required
 *     feature is missing rather than half-booting silently
 *
 * The manifest is ALSO the unit a future plug-and-play toggle disables:
 * dropping a feature from `featureRegistry` removes its services,
 * resolvers, schema, authz, and routes in one move.
 *
 * Keep this file leaf-level — no imports of feature code, no imports
 * of `mongoDBConnection`. The registry itself constructs services and
 * stitches the rest.
 */

export interface FeatureContext {
    /** Shared mongo db handle — every feature uses the same one. */
    db: Db;
    /** Shared redis handle — features that need it (Cart, rate limits) read here. */
    redis: RedisLike;
    /**
     * Service map built so far. Earlier features in the registry are
     * already populated; later features can declare a dependency via
     * `requires` and read those services from this map.
     */
    services: Record<string, unknown>;
    /**
     * Connection-level reconnect callback. Services that pre-date the
     * manifest pattern (Users, Languages, Assets, Navigation) take a
     * `reconnect` arg in their constructors so they can re-trigger
     * `MongoDBConnection.setupClient()` on a transient driver-side
     * blip. The connection class supplies it when calling
     * `bootFeaturesSync` — manifests must NOT reach back to
     * `getMongoConnection()` at construction time (would re-enter the
     * still-running constructor and stack-overflow).
     */
    reconnect: () => Promise<void>;
}

export interface FeatureIndexSpec {
    collection: string;
    /** Mongo index keys. Same shape as `Collection.createIndex(spec)`. */
    spec: Record<string, 1 | -1 | 'text' | 'hashed'>;
    options?: {
        name?: string;
        unique?: boolean;
        sparse?: boolean;
        partialFilterExpression?: Record<string, unknown>;
        /**
         * Static seconds OR a thunk evaluated at boot time. Lets a
         * feature read env-driven retention (`AUDIT_LOG_RETENTION_DAYS`,
         * `ERROR_LOG_RETENTION_DAYS`, …) without locking the value at
         * manifest-import time.
         */
        expireAfterSeconds?: number | (() => number);
    };
}

/**
 * Authz table contributions — additive entries the registry merges into
 * the global authz tables. Same shape `services/features/Auth/authz.ts`
 * uses internally.
 */
export interface FeatureAuthzContribution {
    /** Methods that need an editor+/admin role for mutations. */
    mutationRequirements?: Record<string, 'admin' | 'editor' | 'viewer'>;
    /** Methods that need a role for read-side queries. */
    queryRequirements?: Record<string, 'admin' | 'editor' | 'viewer'>;
    /**
     * Methods the resolver should auto-inject the ADMIN `_session` into.
     * Pattern: write-side ops that need to stamp the actor's email on
     * audit rows (e.g. `saveTheme`, `savePost`, …).
     */
    sessionInjected?: readonly string[];
    /**
     * Methods the resolver should auto-inject the CUSTOMER `_session`
     * into. Pattern: customer-facing reads/writes that need to scope
     * to the calling customer (`getMe`, `myOrders`, `updateMyProfile`,
     * `myAddresses`, …). Distinct from `sessionInjected` so the
     * admin/customer authz proxies inject the right session shape.
     */
    customerSessionInjected?: readonly string[];
    /** Methods that customer-kind sessions are allowed to call. */
    customerMutations?: readonly string[];
    customerQueries?: readonly string[];
    /** Methods anonymous (no session) callers can invoke. */
    anonOpenMutations?: readonly string[];
    /** Per-method rate-limit / capability tags consumed by `guardMethods`. */
    capabilities?: Record<string, 'canPublishProduction' | 'canEditUsers'>;

    /**
     * Per-method resource-scoped gating. Maps a method name to an
     * extractor that pulls `{scope, resourceId}` out of the call args
     * — `guardMethods` then runs `PermissionService.can()` after the
     * role/capability check passes. Per `docs/features/platform/edit-levels.md`.
     *
     * Example (Posts feature gating `savePost` to page-owners):
     *   resourceGated: {
     *       savePost: (args) => ({scope: 'page', resourceId: args.post?.id}),
     *   }
     *
     * Returning `null` from the extractor skips the per-resource check
     * (e.g. for create-flow methods where there's no existing resource yet).
     */
    resourceGated?: Record<string, (args: any) => {scope: 'page' | 'module' | 'element'; resourceId: string} | null>;
}

export interface FeatureManifest {
    /** Stable id — matches the folder name in lowerCamelCase. */
    id: string;
    /** Human-readable name (admin UI, error messages). */
    displayName: string;

    /**
     * Other feature ids this one depends on. The registry topologically
     * sorts; cycles + missing deps fail at startup.
     */
    requires?: readonly string[];

    /**
     * If `false`, the registry skips this feature entirely at boot —
     * no service constructed, no SDL contributed, no resolvers, no
     * authz, no `onBoot`. The default (omitted / `true`) keeps the
     * feature on. Reads happen at boot, so a flip requires a server
     * restart; runtime mutations are a future concern.
     *
     * Use a thunk if the decision depends on env vars or a flags
     * service: `enabled: () => process.env.FEATURE_CART !== 'false'`.
     * The `featureFlags.ts` helper centralises the env-var convention.
     */
    enabled?: boolean | (() => boolean);

    /**
     * "Always on" — the platform depends on this feature being present.
     * The plug-and-play UI hides the toggle for these so a misconfigured
     * flag can never knock the system over. Set on Audit, Users,
     * Languages, Themes, Posts, Footer, SiteFlags / Seo (the SiteFlags
     * service itself reads the flags), Navigation, Bundle, Publishing,
     * Assets, Presence, Observability — i.e. the CMS-core baseline.
     */
    coreInfrastructure?: boolean;

    /**
     * Construct services. Returns a map `{<key>: instance}` that's
     * shallow-merged into the shared service map. Later features see
     * earlier ones via `ctx.services`.
     *
     * Lazy by convention — the registry calls this once at boot, after
     * the db connection is established and the prior features ran.
     */
    services?: (ctx: FeatureContext) => Record<string, unknown>;

    /** Mongo indexes to ensure on first connect. */
    indexes?: readonly FeatureIndexSpec[];

    /** GraphQL SDL fragment as a string. Concatenated into the composed schema. */
    schemaSDL?: string;

    /**
     * Resolver tree — merged into the composed resolver map. Use the
     * standard `{Query: {...}, Mutation: {...}, …}` shape; the merger
     * is conflict-strict (two features can't both define the same field).
     */
    resolvers?: Record<string, unknown>;

    /** Authz table contributions. */
    authz?: FeatureAuthzContribution;

    /**
     * Optional one-shot lifecycle hook. Runs after services are built
     * and indexes are applied. Use for cache warmup, default seeding,
     * etc. Throwing aborts boot.
     */
    onBoot?: (ctx: FeatureContext) => Promise<void> | void;

    /**
     * Functional roles the feature contributes (e.g. `translator` from
     * Languages, `content-editor` from Posts). Composed by
     * `composedFunctionalRoles()` from `featureRegistry`. Per
     * `docs/features/platform/edit-levels.md` (decision 4).
     */
    functionalRoles?: readonly import('@interfaces/IPermission').FunctionalRoleDescriptor[];

    /**
     * Cache-version keys this feature owns (per C9 production caching).
     * Bumping any listed key invalidates downstream Caddy SWR entries
     * tagged with the feature. Empty/omitted means the feature does
     * not participate in the cache-version protocol.
     */
    cacheVersionKeys?: readonly string[];

    /**
     * Optional DataLoader-style batched accessors — factories invoked
     * once per request, returning a `BatchLoader` instance reachable
     * through the resolver request context (`ctx.batch.<feature>.<accessor>`).
     * Type loose by design (see `ServiceLoader.batchAccessors`).
     */
    batchAccessors?: Record<string, (ctx: FeatureContext) => unknown>;
}
