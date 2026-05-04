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
