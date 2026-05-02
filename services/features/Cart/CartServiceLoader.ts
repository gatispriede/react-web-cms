import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {CartService} from './CartService';
import {mintCartCookie} from './cartCookie';
import type {CartOwner} from '@interfaces/ICart';
import type {ProductService} from '@services/features/Products/ProductService';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/**
 * Cart Loader — Class Loader L3 migration of `cartFeature`.
 *
 * Cycle note: this file imports `getMongoConnection`. The reverse edge —
 * mongoDBConnection → featureRegistry → this manifest — is via a dynamic
 * `await import()` inside `setupClient`, so the cycle resolves at runtime.
 *
 * `requires: ['products']`: structurally cart depends on the
 * ProductService that products contributes. Topological sort boots
 * Products first; `ctx.services.products` is populated when this loader's
 * `buildServices` runs.
 *
 * Resolver bypass: cart resolvers do NOT go through `guardMethods` — authz
 * is owner-based ("you own the resource bound to your cookie or session"),
 * not role-based. Resolvers derive the owner inline via `ownerFromCtx` and
 * call the service directly.
 *
 * Audit policy: customer cart mutations are intentionally NOT audited
 * (privacy + volume — see cart.md §11.8). Reflected as "no audit trace" —
 * same as the legacy `MongoDBConnection.cart*` methods.
 */

interface CartResolverHooks {
    getCartCookieId?: () => string | null;
    setCartCookie?: (signedValue: string) => void;
}

interface CartResolverSession {
    kind?: 'admin' | 'customer' | 'anonymous';
    customerId?: string;
}

interface CartResolverCtx {
    session: CartResolverSession;
    hooks?: CartResolverHooks;
}

/** Owner derivation — mirrors `graphqlResolvers.ts`. Customer session
 *  wins when present so a signed-in shopper cannot fall back to a stale
 *  cookie cart. For guests, an absent or forged cookie causes the
 *  resolver to mint a fresh signed cookie and queue it on the response. */
function ownerFromCtx(ctx: CartResolverCtx): CartOwner {
    if (ctx.session.kind === 'customer' && ctx.session.customerId) {
        return {kind: 'customer', customerId: ctx.session.customerId};
    }
    const existing = ctx.hooks?.getCartCookieId?.();
    if (existing) return {kind: 'guest', cartId: existing};
    const minted = mintCartCookie();
    ctx.hooks?.setCartCookie?.(minted.cookieValue);
    return {kind: 'guest', cartId: minted.cartId};
}

const json = <T>(p: Promise<T>): Promise<string> =>
    p.then(v => JSON.stringify(v))
        .catch(err => JSON.stringify({error: String((err as Error).message || err)}));

/** Resolve the live CartService from the boot-merged service map.
 *  Going through `getMongoConnection().cartService` keeps the existing
 *  field as the single read-point — that field is now a getter that
 *  returns `featureServices.cart` (see `mongoDBConnection.ts`). */
function svc(): CartService {
    const conn = getMongoConnection() as unknown as {cartService: CartService};
    return conn.cartService;
}

export class CartServiceLoader extends ServiceLoader {
    readonly id = 'cart';
    readonly displayName = 'Shopping cart';
    readonly requires = ['products'] as const;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        // `requires: ['products']` guarantees Products has booted first,
        // so `ctx.services.products` is always populated by the topological
        // sort.
        const products = ctx.services.products as ProductService | undefined;
        if (!products) {
            throw new Error('CartServiceLoader: ProductService missing from ctx.services.products');
        }
        return {cart: new CartService(ctx.db, ctx.redis, products)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        // Extracted from `CartService.ensureIndexes()`. The in-class call
        // remains as a fallback (idempotent).
        {
            collection: 'Carts',
            spec: {customerId: 1},
            options: {unique: true},
        },
    ];

    readonly schemaSDL = `
        extend type QueryMongo {
            cart: String!
        }
        extend type MutationMongo {
            cartAddItem(productId: String!, sku: String!, qty: Int!): String!
            cartUpdateQty(productId: String!, sku: String!, qty: Int!): String!
            cartRemoveItem(productId: String!, sku: String!): String!
            cartClear: String!
        }
    `;

    readonly resolvers = {
        QueryMongo: {
            // Bypass `guardMethods` — owner-based authz, see file header.
            cart: (_parent: unknown, _args: unknown, ctx: CartResolverCtx) =>
                json(svc().getCart(ownerFromCtx(ctx))),
        },
        MutationMongo: {
            cartAddItem: (_parent: unknown, args: {productId: string; sku: string; qty: number}, ctx: CartResolverCtx) =>
                json(svc().addItem(ownerFromCtx(ctx), args)),
            cartUpdateQty: (_parent: unknown, args: {productId: string; sku: string; qty: number}, ctx: CartResolverCtx) =>
                json(svc().updateQty(ownerFromCtx(ctx), args)),
            cartRemoveItem: (_parent: unknown, args: {productId: string; sku: string}, ctx: CartResolverCtx) =>
                json(svc().removeItem(ownerFromCtx(ctx), args)),
            cartClear: (_parent: unknown, _args: unknown, ctx: CartResolverCtx) =>
                json(svc().clear(ownerFromCtx(ctx))),
        },
    };

    /**
     * Cart endpoints bypass `guardMethods` (owner-based, not role-based),
     * so they don't appear in the admin requirements tables and aren't
     * gated as customer-only or anon-open mutations. The empty contribution
     * is intentional — do NOT add cart entries to `customerMutations` /
     * `anonOpenMutations`, that would route them through the proxy and
     * double-gate them.
     */
    readonly authz: FeatureAuthzContribution = {};
}
