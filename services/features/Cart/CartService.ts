import {Collection, Db} from 'mongodb';
import {Cart, CartLineItem, CartOwner, CartWarning, InsufficientStockError} from '@interfaces/ICart';
import {ProductService} from '@services/features/Products/ProductService';
import {nextVersion, requireVersion} from '@services/infra/conflict';
import type {RedisLike} from '@services/infra/redis';

/**
 * Cart service — backs both guest carts (Redis) and customer carts
 * (Mongo `Carts` collection). See docs/features/cart.md.
 *
 * Two-store split:
 *  - Guest carts live in Redis under `cart:guest:<cartId>` with a sliding
 *    30-day TTL refreshed on every read or write. The cookie is opaque
 *    (signed UUID); the value is a JSON-serialised Cart.
 *  - Customer carts live in Mongo with optimistic concurrency through
 *    `nextVersion` / `requireVersion` (same pattern as Posts/Products).
 *
 * Stock is **soft-validated** at add/updateQty: requested qty is clamped
 * to current stock, with a `warnings` entry on the returned cart. A
 * 0-stock add throws `InsufficientStockError`. Hard stock reservation is
 * a checkout concern.
 *
 * Currency is **locked** on the first item; later adds in a different
 * currency throw 'cart currency mismatch'.
 *
 * Customer cart mutations are NOT audited (privacy + volume — see spec §11.8).
 */

const REDIS_PREFIX = 'cart:guest:';
/** 30 days, sliding — refreshed on every read and every write. */
const GUEST_TTL_SECONDS = 60 * 60 * 24 * 30;

const emptyCart = (): Cart => ({
    items: [],
    currency: null,
    subtotal: 0,
    updatedAt: new Date().toISOString(),
});

const computeSubtotal = (items: CartLineItem[]): number =>
    items.reduce((sum, it) => sum + it.qty * it.priceSnapshot, 0);

const finalize = (cart: Cart, warnings?: CartWarning[]): Cart => {
    const out: Cart = {
        items: cart.items,
        currency: cart.currency,
        subtotal: computeSubtotal(cart.items),
        updatedAt: cart.updatedAt,
    };
    if (warnings && warnings.length) out.warnings = warnings;
    return out;
};

const sameLine = (a: {productId: string; sku: string}, b: {productId: string; sku: string}): boolean =>
    a.productId === b.productId && a.sku === b.sku;

const productLine = (product: {price: number; currency: string; stock: number; variants?: {sku: string; price?: number; stock: number}[]}, sku: string): {price: number; stock: number} => {
    const variants = product.variants ?? [];
    if (variants.length > 0) {
        const v = variants.find(x => x.sku === sku);
        if (v) return {price: v.price ?? product.price, stock: v.stock};
    }
    return {price: product.price, stock: product.stock};
};

export class CartService {
    private carts: Collection;
    private indexesReady = false;

    constructor(
        private db: Db,
        private redis: RedisLike,
        private products: ProductService,
    ) {
        this.carts = db.collection('Carts');
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.carts.createIndex({customerId: 1}, {unique: true});
            this.indexesReady = true;
        } catch (err) {
            console.error('CartService.ensureIndexes:', err);
        }
    }

    // ---------------- Guest path (Redis) ----------------

    private guestKey(cartId: string): string {
        return `${REDIS_PREFIX}${cartId}`;
    }

    private async loadGuest(cartId: string): Promise<Cart> {
        const raw = await this.redis.get(this.guestKey(cartId));
        if (!raw) return emptyCart();
        try {
            const parsed = JSON.parse(raw) as Cart;
            // Sliding TTL refresh on read.
            await this.redis.set(this.guestKey(cartId), raw, GUEST_TTL_SECONDS);
            return {
                items: Array.isArray(parsed.items) ? parsed.items : [],
                currency: parsed.currency ?? null,
                subtotal: 0, // re-computed by finalize
                updatedAt: parsed.updatedAt ?? new Date().toISOString(),
            };
        } catch {
            // Malformed payload — drop and start fresh.
            await this.redis.del(this.guestKey(cartId));
            return emptyCart();
        }
    }

    private async saveGuest(cartId: string, cart: Cart): Promise<void> {
        const persisted = {
            items: cart.items,
            currency: cart.currency,
            updatedAt: cart.updatedAt,
        };
        await this.redis.set(this.guestKey(cartId), JSON.stringify(persisted), GUEST_TTL_SECONDS);
    }

    // ---------------- Customer path (Mongo) ----------------

    private async loadCustomer(customerId: string): Promise<{cart: Cart; version: number}> {
        await this.ensureIndexes();
        const doc = await this.carts.findOne({customerId}, {projection: {_id: 0}}) as any;
        if (!doc) {
            return {cart: emptyCart(), version: 0};
        }
        return {
            cart: {
                items: Array.isArray(doc.items) ? doc.items : [],
                currency: doc.currency ?? null,
                subtotal: 0,
                updatedAt: doc.updatedAt ?? new Date().toISOString(),
            },
            version: typeof doc.version === 'number' ? doc.version : 0,
        };
    }

    private async saveCustomer(customerId: string, cart: Cart, expectedVersion: number): Promise<void> {
        await this.ensureIndexes();
        const existing = await this.carts.findOne({customerId});
        const existingVersion = existing ? ((existing as any).version ?? 0) : 0;
        if (existing) {
            requireVersion(existing, existingVersion, expectedVersion, `Cart for customer ${customerId}`);
        }
        const version = nextVersion(existingVersion);
        const now = cart.updatedAt;
        if (!existing) {
            await this.carts.insertOne({
                customerId,
                items: cart.items,
                currency: cart.currency,
                createdAt: now,
                updatedAt: now,
                version,
            } as any);
        } else {
            await this.carts.updateOne(
                {customerId},
                {$set: {items: cart.items, currency: cart.currency, updatedAt: now, version}},
            );
        }
    }

    // ---------------- Public API ----------------

    async getCart(owner: CartOwner): Promise<Cart> {
        if (owner.kind === 'guest') {
            const cart = await this.loadGuest(owner.cartId);
            return finalize(cart);
        }
        const {cart} = await this.loadCustomer(owner.customerId);
        return finalize(cart);
    }

    async addItem(owner: CartOwner, input: {productId: string; sku: string; qty: number}): Promise<Cart> {
        const qty = Math.max(1, Math.floor(input.qty || 1));
        const product = await this.products.getById(input.productId);
        if (!product) throw new Error('product not found');
        const {price, stock} = productLine(product, input.sku);
        if (stock <= 0) throw new InsufficientStockError(input.sku);

        return this.mutate(owner, (cart) => {
            const warnings: CartWarning[] = [];
            // Currency lock — first item dictates currency.
            if (cart.currency && cart.currency !== product.currency) {
                throw new Error('cart currency mismatch');
            }
            const idx = cart.items.findIndex(it => sameLine(it, input));
            const desiredQty = idx >= 0 ? cart.items[idx].qty + qty : qty;
            const finalQty = Math.min(desiredQty, stock);
            if (finalQty < desiredQty) {
                warnings.push({sku: input.sku, reason: 'clamped'});
            }
            if (idx >= 0) {
                cart.items[idx] = {...cart.items[idx], qty: finalQty};
            } else {
                cart.items.push({
                    productId: input.productId,
                    sku: input.sku,
                    qty: finalQty,
                    priceSnapshot: price,
                    currency: product.currency,
                });
            }
            if (!cart.currency) cart.currency = product.currency;
            cart.updatedAt = new Date().toISOString();
            return warnings;
        });
    }

    async updateQty(owner: CartOwner, input: {productId: string; sku: string; qty: number}): Promise<Cart> {
        const qty = Math.max(0, Math.floor(input.qty));
        // qty=0 is a remove — short-circuit and skip the product lookup.
        if (qty === 0) {
            return this.removeItem(owner, {productId: input.productId, sku: input.sku});
        }
        const product = await this.products.getById(input.productId);
        if (!product) throw new Error('product not found');
        const {stock} = productLine(product, input.sku);
        return this.mutate(owner, (cart) => {
            const warnings: CartWarning[] = [];
            const idx = cart.items.findIndex(it => sameLine(it, input));
            if (idx < 0) {
                // Not in cart — nothing to update.
                return warnings;
            }
            const finalQty = Math.min(qty, Math.max(0, stock));
            if (finalQty < qty) warnings.push({sku: input.sku, reason: 'clamped'});
            if (finalQty <= 0) {
                cart.items.splice(idx, 1);
                if (cart.items.length === 0) cart.currency = null;
            } else {
                cart.items[idx] = {...cart.items[idx], qty: finalQty};
            }
            cart.updatedAt = new Date().toISOString();
            return warnings;
        });
    }

    async removeItem(owner: CartOwner, input: {productId: string; sku: string}): Promise<Cart> {
        return this.mutate(owner, (cart) => {
            const before = cart.items.length;
            cart.items = cart.items.filter(it => !sameLine(it, input));
            if (cart.items.length !== before) {
                cart.updatedAt = new Date().toISOString();
                if (cart.items.length === 0) cart.currency = null;
            }
            return [];
        });
    }

    async clear(owner: CartOwner): Promise<Cart> {
        return this.mutate(owner, (cart) => {
            cart.items = [];
            cart.currency = null;
            cart.updatedAt = new Date().toISOString();
            return [];
        });
    }

    /**
     * Merge guest cart (Redis) into the customer cart (Mongo), then
     * delete the Redis key. Per spec §4: same `(productId, sku)` lines
     * sum qtys, capped at current product stock; price snapshot is kept
     * from the existing customer-cart line if present, else from the
     * guest line.
     */
    async mergeGuestIntoCustomer(cartId: string, customerId: string): Promise<Cart> {
        const guestRaw = await this.redis.get(this.guestKey(cartId));
        if (!guestRaw) {
            // Nothing to merge — just return the customer cart untouched.
            return this.getCart({kind: 'customer', customerId});
        }
        let guest: Cart;
        try {
            guest = JSON.parse(guestRaw) as Cart;
        } catch {
            await this.redis.del(this.guestKey(cartId));
            return this.getCart({kind: 'customer', customerId});
        }

        const {cart, version} = await this.loadCustomer(customerId);
        const guestItems = Array.isArray(guest.items) ? guest.items : [];

        for (const g of guestItems) {
            const idx = cart.items.findIndex(it => sameLine(it, g));
            // Re-read live stock for cap. If product is gone, drop the line.
            const product = await this.products.getById(g.productId);
            if (!product) continue;
            const {stock} = productLine(product, g.sku);
            if (idx >= 0) {
                const summed = cart.items[idx].qty + g.qty;
                cart.items[idx] = {
                    ...cart.items[idx],
                    qty: Math.min(summed, Math.max(0, stock)),
                    // Existing customer-cart price snapshot wins (spec §4).
                };
            } else {
                cart.items.push({
                    productId: g.productId,
                    sku: g.sku,
                    qty: Math.min(g.qty, Math.max(0, stock)),
                    priceSnapshot: g.priceSnapshot,
                    currency: g.currency,
                });
            }
            if (!cart.currency) cart.currency = g.currency;
        }

        // Filter zero-qty (everything stocked-out) lines.
        cart.items = cart.items.filter(it => it.qty > 0);
        if (cart.items.length === 0) cart.currency = null;
        cart.updatedAt = new Date().toISOString();

        await this.saveCustomer(customerId, cart, version);
        await this.redis.del(this.guestKey(cartId));
        return finalize(cart);
    }

    // ---------------- Internal mutate dispatcher ----------------

    /**
     * Loads the right backend, runs `apply` against a mutable `Cart`,
     * persists the result, and returns the finalised view (with
     * computed subtotal + transient warnings).
     */
    private async mutate(
        owner: CartOwner,
        apply: (cart: Cart) => CartWarning[],
    ): Promise<Cart> {
        if (owner.kind === 'guest') {
            const cart = await this.loadGuest(owner.cartId);
            const warnings = apply(cart);
            await this.saveGuest(owner.cartId, cart);
            return finalize(cart, warnings);
        }
        const {cart, version} = await this.loadCustomer(owner.customerId);
        const warnings = apply(cart);
        await this.saveCustomer(owner.customerId, cart, version);
        return finalize(cart, warnings);
    }
}
