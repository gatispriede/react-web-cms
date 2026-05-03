import redisConnection from "@services/infra/redisConnection";
import {getMongoConnection} from "@services/infra/mongoDBConnection";
import {composedResolvers} from "@services/infra/featureRegistry";
import {
    guardMethods,
    MUTATION_REQUIREMENTS,
    MUTATION_CAPABILITIES,
    QUERY_REQUIREMENTS,
    RESOURCE_GATED_METHODS,
    AuthzError,
    GraphqlSession,
} from "@services/features/Auth/authz";
import {RequestPermissionCache} from "@services/features/Permissions/PermissionService";

/**
 * Hook injected by the Next API route — checks IP-based rate limit on
 * anonymous-reachable customer mutations (sign-up). The standalone
 * server doesn't set this; standalone resolvers don't expose
 * `signUpCustomer` either, so rate-limiting is moot there.
 */
export interface ResolverHooks {
    rateLimitSignup?: () => {ok: true} | {ok: false; retryAfterMs: number};
    /**
     * Cart cookie hooks. The Next API route reads the `cart_id` cookie
     * off the request and exposes it here; if no valid cookie exists,
     * the cart resolvers mint a fresh one and call `setCartCookie` to
     * queue a `Set-Cookie` on the response.
     */
    getCartCookieId?: () => string | null;
    setCartCookie?: (signedValue: string) => void;
    /**
     * Order-token cookie hooks (guest checkout confirmation). The
     * `finalizeOrder` resolver reads the minted token off the order
     * payload and queues a Set-Cookie via `setOrderTokenCookie`. The
     * `orderByToken` resolver reads the request cookie back via
     * `getOrderTokenCookie` so the service can compare token-arg vs
     * cookie-value before returning the order.
     */
    getOrderTokenCookie?: () => string | null;
    setOrderTokenCookie?: (token: string) => void;
}

// Cart owner derivation moved to services/features/Cart/feature.manifest.ts
// alongside the cart resolvers themselves (Cart Phase B migration).

/**
 * Shared GraphQL resolver shapes used by both servers:
 *  - `Next /api/graphql` (apollo-server-micro, session-aware, role-gated)
 *  - `src/Server/index.ts` standalone (express-graphql, localhost/build-time only)
 *
 * The two servers exist for different reasons: the Next route serves live
 * admin traffic behind NextAuth; the standalone server runs during SSG build
 * (before Next is up) and on-box for rare ops work. Keeping resolvers in one
 * place so they can't drift.
 */
const red = new redisConnection();

/** Resolver map for the standalone server — no auth wrapping. */
export const standaloneResolvers = {
    Query: {
        bar: (): Promise<string | null> => red.getBar(),
        sample: () => "sample",
        mongo: () => getMongoConnection(),
    },
    Mutation: {
        mongo: () => getMongoConnection(),
    },
};

/**
 * Build the permission-check predicate the proxy uses to gate per-resource
 * grants. Reads through a request-scoped cache (decision 6 — same `(user,
 * scope, resourceId)` triple inside a request hits Mongo once). Returns
 * `undefined` when the Permissions feature isn't booted (PermissionService
 * absent → no gating, fall back to role-only).
 */
function buildPermissionCheck(): import('@services/features/Auth/authz').PermissionCheck | undefined {
    const conn = getMongoConnection();
    const svc = conn.permissionService;
    if (!svc) return undefined;
    const cache = new RequestPermissionCache();
    return (opts) => svc.can({...opts, cache});
}

/**
 * Q10 — request-scoped resolver returning the caller's `grants` array.
 * Looks up the user once via UsersService; subsequent calls inside the
 * same request hit the local memo. Returns `[]` when no Users service is
 * wired or the session has no email (anonymous / customer).
 */
function buildGrantResolver(): import('@services/features/Auth/authz').GrantResolver {
    const conn = getMongoConnection();
    const users = conn.userService;
    let memo: Promise<readonly import('@interfaces/IPermission').Grant[]> | null = null;
    return async (session) => {
        if (!users || !session.email) return [];
        if (!memo) {
            memo = users
                .getUser({email: session.email})
                .then(u => ((u as {grants?: readonly import('@interfaces/IPermission').Grant[]} | undefined)?.grants ?? []))
                .catch(() => [] as readonly import('@interfaces/IPermission').Grant[]);
        }
        return memo;
    };
}

/** Resolver map for the Next route — mongo proxied through `guardMethods`. */
export const nextResolvers = {
    Query: {
        sample: () => "sample",
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(getMongoConnection(), ctx.session, QUERY_REQUIREMENTS),
    },
    Mutation: {
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(
                getMongoConnection(),
                ctx.session,
                MUTATION_REQUIREMENTS,
                MUTATION_CAPABILITIES,
                RESOURCE_GATED_METHODS,
                buildPermissionCheck(),
                buildGrantResolver(),
            ),
    },
    // The customer-facing schema fields live on QueryMongo / MutationMongo
    // — but the underlying MongoDBConnection method names diverge in one
    // case (`me` field → `getMe()` method). Field-level resolvers bridge
    // the gap and apply per-field gates (the anon rate-limit on signUp).
    QueryMongo: {
        me: (parent: any) => {
            // `parent` is whatever QueryMongo.mongo returned — i.e. the
            // already-guarded Proxy. The Proxy injects `_session` for
            // `getMe`. Returns `null` when the caller isn't a customer.
            try {
                return parent.getMe();
            } catch (e) {
                if (e instanceof AuthzError) return null;
                throw e;
            }
        },
        // Cart's `cart` query is owned by the Cart feature manifest
        // (services/features/Cart/feature.manifest.ts) and merged in
        // below via `composedResolvers()`.
        // Orders' `orderByToken` query is owned by the Orders feature
        // manifest (services/features/Orders/feature.manifest.ts) — same
        // merge path; the cookie-token wiring lives there.
    },
    MutationMongo: {
        signUpCustomer: (parent: any, args: {customer: any}, ctx: {hooks?: ResolverHooks}) => {
            const limit = ctx.hooks?.rateLimitSignup?.();
            if (limit && !limit.ok) {
                return JSON.stringify({error: `Too many sign-up attempts, try again in ${Math.ceil(limit.retryAfterMs / 1000)}s`});
            }
            return parent.signUpCustomer(args);
        },
        // Cart mutations (cartAddItem / cartUpdateQty / cartRemoveItem /
        // cartClear) are owned by the Cart feature manifest and merged in
        // below via `composedResolvers()`.
        // Orders / checkout mutations (createDraftOrder, attachOrderAddress,
        // attachOrderShipping, authorizeOrderPayment, finalizeOrder,
        // cancelOrder) plus the guest-checkout site-flag guard are owned by
        // the Orders feature manifest (services/features/Orders/feature.manifest.ts).
    },
};

// Merge feature-manifest resolvers into the live map. Currently a no-op
// (no migrated feature contributes resolvers yet — Cart is the first
// candidate per service-modularity.md Phase B). Same module-load pass
// would let a `services/features/<X>/feature.manifest.ts` add a Query
// or Mutation field by listing it under `resolvers.Query` / `.Mutation`.
const _manifestResolvers = composedResolvers();
for (const [topKey, fields] of Object.entries(_manifestResolvers)) {
    const target = (nextResolvers as Record<string, any>)[topKey] ?? {};
    (nextResolvers as Record<string, any>)[topKey] = {...target, ...fields};
}

// `guestCheckoutGuard` moved to services/features/Orders/feature.manifest.ts
// alongside the six checkout-flow resolvers it gated.
