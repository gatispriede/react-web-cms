# Shopping Cart / Basket — Feature Specification

Status: Draft
Owner: e-commerce module
Depends on: Customer Auth spec (separate), Products spec (separate)
Date: 2026-04-29

## 1. Overview

A cart module for the Next.js 15 + MongoDB + GraphQL CMS. Carts must work for two principals:

- **Guest** — anonymous browser identified by a signed cookie (`cartId`).
- **Customer** — signed-in user (Credentials or Google via the customer-auth spec).

When a guest signs in, their guest cart merges into the customer cart. The module follows the existing service/resolver convention used by `services/features/Posts/PostService.ts` and is wired through `services/api/graphqlResolvers.ts` with the `guardMethods` proxy from `services/features/Auth/authz.ts`.

## 2. Storage model

Two backends, split deliberately:

| Principal | Backend | Key | TTL |
|----|----|----|----|
| Guest | Redis | `cart:guest:<cartId>` (cartId = signed cookie) | 30 days, sliding (refresh on every read/write) |
| Customer | MongoDB | `Carts` collection, `{ customerId }` unique index | None (lifetime of account) |

**Why split?**

- Guest carts are high-churn, short-lived, and bound to a cookie. Most are abandoned and never see a checkout. Putting them in Mongo bloats the primary store with garbage that needs scheduled cleanup. Redis gives free TTL eviction, single-key reads, and is already a project dependency (`redis: ^5.12.1`).
- Customer carts are durable, expected to survive devices/browsers, and are queried alongside other customer data. They belong in Mongo with the rest of the persistent domain model.
- The split also keeps the unauthenticated request path off Mongo entirely, which is good for write-amplification on a public storefront.

**Redis schema** — value is a JSON-serialized `Cart` (see §3). Single-key per cart; no per-line keys (avoids partial-update consistency issues, cart is small).

**Mongo schema** — `Carts` collection, document shape:

```
{
  customerId: string,        // unique index
  items: CartLineItem[],
  currency: string,          // cart-level currency, locked on first item
  createdAt: ISODate,
  updatedAt: ISODate,
  version: number            // optimistic concurrency, same pattern as Posts
}
```

## 3. Cart shape

```ts
interface CartLineItem {
    productId: string;       // canonical product id from Products module
    sku: string;             // variant SKU; (productId, sku) is the line key
    qty: number;             // integer >= 1
    priceSnapshot: number;   // price at the moment of add (minor units)
    currency: string;        // ISO-4217, must match cart.currency
}

interface Cart {
    items: CartLineItem[];
    currency: string | null; // null until first item
    subtotal: number;        // computed, never persisted
    updatedAt: string;       // ISO
}
```

**Why snapshot price?**

- The displayed price the shopper agreed to add must be stable across the cart's life — a price drop or rise between "add to cart" and "view cart" must not silently change what the customer sees.
- Any *real* re-pricing is an explicit event: at checkout the cart is re-validated against the live `Products` price and stock; mismatches surface as a "price changed" notice the customer must accept. This is the same pattern used by Shopify/Amazon and avoids both surprise charges and silent discounting.
- Snapshotting also decouples cart reads from a Products lookup, keeping the cart drawer cheap.

`(productId, sku)` is the composite line key. Adding the same SKU increments `qty` rather than appending a new line.

## 4. Service interface — `CartService`

Location: `services/features/Cart/CartService.ts` (mirrors `Posts`).

```ts
export class CartService {
    constructor(
        private db: Db,                     // for customer carts
        private redis: RedisClient,         // for guest carts
        private products: ProductService,   // for stock + price lookup
    ) {}

    // owner is either { kind: 'guest', cartId } or { kind: 'customer', customerId }
    getCart(owner: CartOwner): Promise<Cart>;

    addItem(owner: CartOwner, input: { productId: string; sku: string; qty: number }): Promise<Cart>;

    updateQty(owner: CartOwner, input: { productId: string; sku: string; qty: number }): Promise<Cart>;
    // qty === 0 removes the line.

    removeItem(owner: CartOwner, input: { productId: string; sku: string }): Promise<Cart>;

    clear(owner: CartOwner): Promise<Cart>;

    // Called from the customer-auth callback. Reads guest cart from Redis,
    // merges line-by-line into the customer cart in Mongo, then deletes the
    // Redis key. Merge rule: same (productId, sku) -> sum qtys, capped at
    // current product stock; price snapshot kept from the customer cart's
    // existing line if present, otherwise from the guest line.
    mergeGuestIntoCustomer(cartId: string, customerId: string): Promise<Cart>;
}

type CartOwner =
    | { kind: 'guest'; cartId: string }
    | { kind: 'customer'; customerId: string };
```

Internal helpers: `loadGuest`, `saveGuest` (Redis), `loadCustomer`, `saveCustomer` (Mongo, with `nextVersion`/`requireVersion` from `services/infra/conflict` to match `PostService`).

## 5. GraphQL surface

### `services/api/schema.graphql` additions

```graphql
type CartLineItem {
    productId: ID!
    sku: String!
    qty: Int!
    priceSnapshot: Int!
    currency: String!
}

type Cart {
    items: [CartLineItem!]!
    currency: String
    subtotal: Int!
    updatedAt: String!
}

input CartItemInput {
    productId: ID!
    sku: String!
    qty: Int!
}

input CartItemKeyInput {
    productId: ID!
    sku: String!
}

extend type Query {
    cart: Cart!
}

extend type Mutation {
    cartAddItem(input: CartItemInput!): Cart!
    cartUpdateQty(input: CartItemInput!): Cart!
    cartRemoveItem(input: CartItemKeyInput!): Cart!
    cartClear: Cart!
}
```

No explicit `cartId` argument on the wire — the resolver derives the owner from the request (cookie or session). This prevents a client from reading another cart by guessing an id.

### Resolver signatures (in `services/api/graphqlResolvers.ts`)

```ts
Query.cart        = (_, __, ctx) => cart.getCart(ownerFromCtx(ctx));
Mutation.cartAddItem    = (_, { input }, ctx) => cart.addItem(ownerFromCtx(ctx), input);
Mutation.cartUpdateQty  = (_, { input }, ctx) => cart.updateQty(ownerFromCtx(ctx), input);
Mutation.cartRemoveItem = (_, { input }, ctx) => cart.removeItem(ownerFromCtx(ctx), input);
Mutation.cartClear      = (_, __, ctx)        => cart.clear(ownerFromCtx(ctx));
```

`ctx` is extended to expose `customerSession` and `cartCookieId` (set by the GraphQL handler before resolvers run). `ownerFromCtx` returns `{kind:'customer', customerId}` if the customer session is present, otherwise `{kind:'guest', cartId}`, minting a new signed cookie on the response if none exists.

## 6. Auth / authz

- Cart resolvers do **not** require any CMS role (`viewer`/`editor`/`admin`). Those roles are CMS staff. Cart access is gated by *principal*, not *role*.
- Customers can only read or mutate the cart belonging to their own `customerId` — enforced by deriving the id server-side from the customer session, never from arguments.
- Guests can only read or mutate the cart bound to their signed cookie id. The cookie is HMAC-signed; tampering is rejected and a fresh cart is minted.
- Integration with `authz.ts`: cart methods are not added to `MUTATION_REQUIREMENTS` or `SESSION_INJECTED_METHODS` (those are CMS-staff concerns). Instead, `guardMethods` is wrapped with a small `cartCapability` layer or — simpler — cart resolvers bypass `guardMethods` entirely and call `CartService` directly because their authz model is "principal owns the resource" rather than "role rank". This is documented in code with a comment so it is not mistaken for an oversight.
- `AuthzError` is reused for the rare case of a malformed/forged cookie when the customer is not signed in.

## 7. Cookie strategy

| Field | Value |
|----|----|
| Name | `cart_id` |
| Value | `<uuid>.<hmacSha256(uuid, CART_COOKIE_SECRET)>` |
| `httpOnly` | `true` |
| `sameSite` | `Lax` (allows top-level navigation back from payment providers) |
| `secure` | `true` in production, `false` in dev |
| `path` | `/` |
| `maxAge` | 30 days, refreshed on every cart write |
| Signing | HMAC-SHA-256 with `CART_COOKIE_SECRET` from `secrets/`; rotation supported by accepting *any* of the listed secrets and re-signing with the first |

The cookie holds only an opaque id — never line items. All cart state lives server-side in Redis.

## 8. Public UI

Location: `ui/client/pages/cart/`.

- `ui/client/pages/cart/index.tsx` — full cart page (line items, qty steppers, remove, subtotal, "proceed to checkout" CTA).
- `ui/client/components/cart/CartDrawer.tsx` — slide-in drawer triggered from the header cart icon, renders the same line-item component as the page.
- `ui/client/components/cart/CartLineItem.tsx` — shared row component.
- Client state via a small `useCart()` hook that wraps the GraphQL queries/mutations and exposes optimistic updates.
- No admin UI is in scope. **Open question:** should admins be able to view a customer's cart for support? See §11.

## 9. Test plan

Unit / integration tests under `services/features/Cart/__tests__/`:

- `CartService.guest.test.ts` — uses an in-memory Redis mock (`__mocks__/redis.ts` or `ioredis-mock`-style fake) to cover add, update, remove, clear, TTL refresh, malformed-key rejection.
- `CartService.customer.test.ts` — uses `mongodb-memory-server` (already a devDependency) to cover the same operations plus optimistic concurrency via `requireVersion`.
- `CartService.merge.test.ts` — seeds both a Redis guest cart and a Mongo customer cart, calls `mergeGuestIntoCustomer`, asserts merge rules (qty sum, stock cap, price-snapshot precedence) and that the Redis key is deleted.
- `CartService.stock.test.ts` — stubs `ProductService` to return varying stock and asserts `addItem`/`updateQty` clamp behaviour and the `InsufficientStockError`.
- Resolver tests — drive through `graphqlResolvers.ts` with a fake context to confirm the owner is derived from session/cookie and never from arguments.

UI tests are out of scope for this spec but a smoke test of `useCart` with a mocked GraphQL client is recommended.

## 10. Stock validation

- **On add / updateQty** — soft validation. `CartService` reads current stock from `ProductService`. If requested `qty` exceeds available stock, the cart is updated to `min(qty, stock)` and the response includes a `clamped: true` flag (added to `CartLineItem` as an ephemeral, non-persisted field, or surfaced via a separate `warnings` field on `Cart`). Out-of-stock (`stock === 0`) throws `InsufficientStockError` and the line is not added.
- **On checkout** — hard validation. The checkout flow (separate spec) calls a dedicated `validateForCheckout` method that re-checks stock and price against live product data, returning a list of mismatches the customer must accept before payment.
- Rationale: shoppers commonly leave items in carts overnight; failing hard at add-time is hostile, but charging for unavailable stock is worse. Soft-at-add + hard-at-checkout is the industry norm.

## 11. Open questions

1. **Admin visibility** — should CMS admins be able to view (read-only) a customer's cart for support purposes? If yes, this needs a separate `getCartForCustomer(customerId)` query gated by `admin` role through `MUTATION_REQUIREMENTS`/`QUERY_REQUIREMENTS`.
2. **Multi-currency carts** — current spec locks `currency` on first item. Is that acceptable, or do we need to support cross-currency stores with a per-item currency and a cart-level display currency?
3. **Cart abandonment emails** — out of scope here, but should `Carts` carry enough metadata (last-customer-email-snapshot) for a future scheduled job to find them?
4. **Guest cart TTL refresh** — sliding 30-day TTL means an active guest never loses their cart. Acceptable, or do we want a hard cap (e.g. 90 days regardless of activity)?
5. **Stock reservations** — the current model is "stock is checked but not reserved". A high-traffic launch might require a short reservation window during checkout. Defer to checkout spec?
6. **Promotions / discount codes** — explicitly out of scope here. Where do they live — on the cart, or computed at checkout? Likely a separate `Promotions` module.
7. **Bypassing `guardMethods`** — confirm that calling `CartService` directly from resolvers (bypassing the role-based proxy) is acceptable, or whether we want a parallel `guardCartMethods` for symmetry and audit consistency.
8. **Audit log** — CMS mutations write to the audit log via `editedBy`. Should customer cart mutations be audited? Probably no (privacy + volume), but worth confirming.

---

## Implementation status

Status as of 2026-04-29: **shipped on `develop`** (uncommitted).

Implemented per spec. Decisions taken:
- No admin read-only view of customer carts in v1 (Q1).
- Single currency per cart, locked on first item (Q2).
- Sliding 30-day guest TTL, no hard cap (Q4).
- Stock reservation lives in the checkout module, not cart (Q5).
- Cart resolvers bypass `guardMethods` — principal-based authz, documented inline (Q7).
- Customer cart mutations not audited (Q8).
- Tiny `RedisLike` interface so tests use an in-memory `Map` fake — no `ioredis-mock` dependency.
- `redis` client loaded via dynamic `eval('require')` so Turbopack/webpack don't bundle it client-side.

Deferred:
- Guest-cart merge on Google sign-in callback — `signIn` callback doesn't have request-cookie access for the OAuth redirect path. Credentials path is wired and is the most common flow.

Files: `shared/types/ICart.ts`, `services/features/Cart/{CartService.ts,CartService.test.ts,cartCookie.ts}`, `services/infra/redis.ts`, `services/api/{schema.graphql,graphqlResolvers.ts}`, `services/infra/mongoDBConnection.ts`, `ui/client/pages/api/{graphql.ts,auth/authOptions.ts}`, `ui/client/pages/cart/index.tsx`, `ui/client/pages/products/{index.tsx,[slug].tsx}`, `ui/client/components/cart/{useCart.ts,CartIcon.tsx,CartLineItem.tsx,CartDrawer.tsx}`. Tests: 22 new.
