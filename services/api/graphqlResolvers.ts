import redisConnection from "@services/infra/redisConnection";
import {getMongoConnection} from "@services/infra/mongoDBConnection";
import {
    guardMethods,
    MUTATION_REQUIREMENTS,
    MUTATION_CAPABILITIES,
    QUERY_REQUIREMENTS,
    AuthzError,
    GraphqlSession,
} from "@services/features/Auth/authz";

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

import type {CartOwner} from '@interfaces/ICart';
import {mintCartCookie} from '@services/features/Cart/cartCookie';

/**
 * Derive the cart owner from the request context.
 *
 * Cart resolvers deliberately bypass `guardMethods` — authz here is
 * principal-based ("you own the resource bound to your cookie or
 * session"), not role-based. The customer-session branch is preferred
 * when present so a signed-in shopper cannot accidentally fall back to
 * a stale cookie cart. For guests, an absent or forged cookie causes
 * the resolver to mint a fresh signed cookie and queue it on the
 * response via `hooks.setCartCookie`.
 */
function ownerFromCtx(ctx: {session: GraphqlSession; hooks?: ResolverHooks}): CartOwner {
    if (ctx.session.kind === 'customer' && ctx.session.customerId) {
        return {kind: 'customer', customerId: ctx.session.customerId};
    }
    const existing = ctx.hooks?.getCartCookieId?.();
    if (existing) return {kind: 'guest', cartId: existing};
    const minted = mintCartCookie();
    ctx.hooks?.setCartCookie?.(minted.cookieValue);
    return {kind: 'guest', cartId: minted.cartId};
}

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

/** Resolver map for the Next route — mongo proxied through `guardMethods`. */
export const nextResolvers = {
    Query: {
        sample: () => "sample",
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(getMongoConnection(), ctx.session, QUERY_REQUIREMENTS),
    },
    Mutation: {
        mongo: (_: unknown, __: unknown, ctx: {session: GraphqlSession}) =>
            guardMethods(getMongoConnection(), ctx.session, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES),
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
        // Cart resolvers bypass `guardMethods` and call the underlying
        // service directly via the un-proxied connection — authz here
        // is principal-based, not role-based. See `ownerFromCtx`.
        cart: (_parent: any, _args: unknown, ctx: {session: GraphqlSession; hooks?: ResolverHooks}) => {
            return getMongoConnection().getCartFor(ownerFromCtx(ctx));
        },
        // Guest order confirmation: the schema gate is `String!` and we
        // wire the cookie value through here so the service can compare
        // it against the `token` argument.
        orderByToken: (_parent: any, args: {token: string}, ctx: {hooks?: ResolverHooks}) => {
            const cookieToken = ctx.hooks?.getOrderTokenCookie?.() ?? null;
            return getMongoConnection().orderByToken({token: args.token, cookieToken});
        },
    },
    MutationMongo: {
        signUpCustomer: (parent: any, args: {customer: any}, ctx: {hooks?: ResolverHooks}) => {
            const limit = ctx.hooks?.rateLimitSignup?.();
            if (limit && !limit.ok) {
                return JSON.stringify({error: `Too many sign-up attempts, try again in ${Math.ceil(limit.retryAfterMs / 1000)}s`});
            }
            return parent.signUpCustomer(args);
        },
        cartAddItem: (_parent: any, args: {productId: string; sku: string; qty: number}, ctx: {session: GraphqlSession; hooks?: ResolverHooks}) => {
            return getMongoConnection().cartAddItem(ownerFromCtx(ctx), args);
        },
        cartUpdateQty: (_parent: any, args: {productId: string; sku: string; qty: number}, ctx: {session: GraphqlSession; hooks?: ResolverHooks}) => {
            return getMongoConnection().cartUpdateQty(ownerFromCtx(ctx), args);
        },
        cartRemoveItem: (_parent: any, args: {productId: string; sku: string}, ctx: {session: GraphqlSession; hooks?: ResolverHooks}) => {
            return getMongoConnection().cartRemoveItem(ownerFromCtx(ctx), args);
        },
        cartClear: (_parent: any, _args: unknown, ctx: {session: GraphqlSession; hooks?: ResolverHooks}) => {
            return getMongoConnection().cartClear(ownerFromCtx(ctx));
        },
        // ---------------- Orders / checkout ----------------
        createDraftOrder: async (parent: any, args: {cartId?: string; currency: string; guestEmail?: string}, ctx: {session: GraphqlSession; hooks?: ResolverHooks}) => {
            const guard = await guestCheckoutGuard(ctx.session);
            if (guard) return guard;
            // For guest sessions, derive cartId from the cart cookie if
            // the client didn't pass one explicitly.
            let cartId = args.cartId;
            if (!cartId && ctx.session.kind !== 'customer') {
                cartId = ctx.hooks?.getCartCookieId?.() ?? undefined;
            }
            return parent.createDraftOrder({...args, cartId});
        },
        attachOrderAddress: (parent: any, args: any, ctx: {session: GraphqlSession}) => {
            return guestCheckoutGuard(ctx.session).then(g => g ?? parent.attachOrderAddress(args));
        },
        attachOrderShipping: (parent: any, args: any, ctx: {session: GraphqlSession}) => {
            return guestCheckoutGuard(ctx.session).then(g => g ?? parent.attachOrderShipping(args));
        },
        authorizeOrderPayment: (parent: any, args: any, ctx: {session: GraphqlSession}) => {
            return guestCheckoutGuard(ctx.session).then(g => g ?? parent.authorizeOrderPayment(args));
        },
        finalizeOrder: async (parent: any, args: any, ctx: {session: GraphqlSession; hooks?: ResolverHooks}) => {
            const guard = await guestCheckoutGuard(ctx.session);
            if (guard) return guard;
            const result = await parent.finalizeOrder(args);
            // For guest orders, queue the order_token cookie.
            try {
                const parsed = JSON.parse(result);
                const order = parsed?.finalizeOrder;
                if (order && !order.customerId && order.orderToken && ctx.hooks?.setOrderTokenCookie) {
                    ctx.hooks.setOrderTokenCookie(order.orderToken);
                }
            } catch { /* error envelope — pass through */ }
            return result;
        },
        cancelOrder: (parent: any, args: any, ctx: {session: GraphqlSession}) => {
            return guestCheckoutGuard(ctx.session).then(g => g ?? parent.cancelOrder(args));
        },
    },
};

/**
 * Guest-checkout policy gate. Returns a serialised error envelope when
 * an anonymous caller hits a checkout-flow mutation but the site flag
 * is off; returns `null` when the call is allowed to proceed. Customer
 * and admin sessions are unaffected.
 */
async function guestCheckoutGuard(session: GraphqlSession): Promise<string | null> {
    if (session.kind !== 'anonymous') return null;
    try {
        const flagsRaw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(flagsRaw);
        // `allowGuestCheckout` defaults to true when unset (per spec).
        const allowed = flags?.allowGuestCheckout !== false;
        if (allowed) return null;
        return JSON.stringify({error: 'Guest checkout is disabled. Sign in to place an order.'});
    } catch {
        // Reading site flags shouldn't happen-fail. Default to allow so
        // checkout doesn't go down on an unrelated SiteSettings read
        // glitch — a soft fail-open here is the lesser harm.
        return null;
    }
}
