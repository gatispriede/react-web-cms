/**
 * Cart domain types — see docs/features/cart.md.
 *
 * The cart is a small, computed view of a shopper's intended order.
 * Two storage backends back this same logical shape:
 *  - guest carts in Redis under `cart:guest:<cartId>`,
 *  - customer carts in MongoDB `Carts` collection.
 *
 * `subtotal` is computed at read time, never persisted.
 * `warnings` is in-memory only (e.g. qty clamped to available stock) —
 * it surfaces transient validation messages to the UI without polluting
 * the persisted document.
 */
export interface CartLineItem {
    productId: string;
    /** Variant SKU; (productId, sku) is the composite line key. */
    sku: string;
    qty: number;
    /** Price snapshot in minor units, captured at add-time. */
    priceSnapshot: number;
    /** ISO-4217. Must match `Cart.currency`. */
    currency: string;
}

export interface CartWarning {
    sku: string;
    reason: string;
}

export interface Cart {
    items: CartLineItem[];
    /** Locked on first item; `null` until the first add. */
    currency: string | null;
    /** Computed sum of qty * priceSnapshot — never persisted. */
    subtotal: number;
    /** ISO timestamp. */
    updatedAt: string;
    /** In-memory only — clamping notices etc. Not persisted. */
    warnings?: CartWarning[];
}

/**
 * Phase 1.B-d — abandoned-cart recovery lifecycle status.
 *
 *  - `active`    : cart has items + customer is still shopping (default).
 *  - `recovered` : a recovery email was sent AND the cart converted to an order.
 *  - `converted` : cart became an order without ever triggering recovery.
 *  - `abandoned` : recovery email was sent, no order followed within the
 *                  observation window — terminal bucket for analytics.
 */
export type CartLifecycleStatus = 'active' | 'recovered' | 'converted' | 'abandoned';

/**
 * Phase 1.B-d — persisted abandoned-cart metadata. Stored as extra
 * fields on the Mongo `Carts` document (customer carts only) — guest
 * carts have no email-of-record so they never get a recovery row. The
 * worker queries on these fields directly so they live on the cart
 * doc rather than in a sidecar collection.
 */
export interface CartRecoveryFields {
    /** Lifecycle marker. Default `active` when omitted. */
    status?: CartLifecycleStatus;
    /** ISO timestamp when the single recovery email was dispatched. `null`
     *  until the worker fires; `null` again is never re-set (one-shot). */
    recoveryEmailSentAt?: string | null;
    /** Optional cached email for guest-cart recovery. Customer carts read
     *  the address off the User row; this slot is a future hook for
     *  guest-cart recovery (Phase 2). */
    guestEmail?: string | null;
}

/** Discriminated owner — derived server-side from session/cookie, never from args. */
export type CartOwner =
    | {kind: 'guest'; cartId: string}
    | {kind: 'customer'; customerId: string};

/** Thrown when an add is attempted against a 0-stock product. */
export class InsufficientStockError extends Error {
    public readonly sku: string;
    constructor(sku: string, message?: string) {
        super(message ?? `Insufficient stock for SKU ${sku}`);
        this.name = 'InsufficientStockError';
        this.sku = sku;
    }
}
