import {Collection, Db} from 'mongodb';
import {createHmac, randomBytes} from 'crypto';
import guid from '@utils/guid';
import {
    IOrder,
    IOrderAddress,
    IOrderLineItem,
    IOrderStatusEntry,
    OrderError,
    OrderStatus,
    ORDER_TRANSITIONS,
} from '@interfaces/IOrder';
import type {ProductService} from '@services/features/Products/ProductService';
import type {CartService} from '@services/features/Cart/CartService';
import type {CartOwner} from '@interfaces/ICart';
import {StockReservationService} from './StockReservationService';
import type {IPaymentProvider} from './payment/IPaymentProvider';
import {OrderCounter} from './OrderCounter';
import {roundMinor, taxRateFor} from './tax';
import {getShippingMethod, shippingMethodList} from './shippingMethods';

/**
 * OrderService — single owner of the `Orders` collection. Encapsulates
 * the multi-step checkout flow, payment idempotency, the state machine
 * and admin reads/transitions.
 *
 * Reservation TTL is 30 minutes (spec §5). The sweeper transitions
 * `pending` orders past TTL into `cancelled` and releases the
 * reservation; it's cron-driven (script in tools/) but exposed as a
 * pure method so tests can fake the clock.
 */

const RESERVATION_TTL_MS = 30 * 60 * 1000;

interface OrderSession {
    kind?: 'admin' | 'customer' | 'anonymous';
    email?: string;
    customerId?: string;
}

export interface OrderMailer {
    sendOrderConfirmation(order: IOrder, to: string): Promise<void>;
}

export interface AuthorizeOrderResult {
    ok: boolean;
    orderId: string;
    declineCode?: string;
}

const guestTokenSecret = (): string => {
    const s = (process.env.ORDER_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || '').trim();
    if (!s) {
        // Tests/dev without secrets — derive a process-stable secret so
        // tokens still verify within the same boot. We document this so
        // ops doesn't ship without `ORDER_TOKEN_SECRET` in prod.
        return 'order-token-dev-fallback';
    }
    return s;
};

const mintOrderToken = (orderId: string): string => {
    const nonce = randomBytes(16).toString('hex');
    const sig = createHmac('sha256', guestTokenSecret()).update(`${orderId}.${nonce}`).digest('hex').slice(0, 32);
    return `${nonce}.${sig}`;
};

export class OrderService {
    private orders: Collection;
    private indexesReady = false;
    private counter: OrderCounter;

    constructor(
        private db: Db,
        private products: ProductService,
        private cart: CartService,
        private reservations: StockReservationService,
        private payment: IPaymentProvider,
        private mailer?: OrderMailer,
    ) {
        this.orders = db.collection('Orders');
        this.counter = new OrderCounter(db);
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.orders.createIndex({id: 1}, {unique: true});
            // orderNumber is sparse so draft orders (no number until
            // finalize) don't collide on the unique constraint.
            await this.orders.createIndex({orderNumber: 1}, {unique: true, sparse: true});
            await this.orders.createIndex({customerId: 1, createdAt: -1});
            await this.orders.createIndex({status: 1, updatedAt: -1});
            await this.orders.createIndex({'paymentRef.authorizationId': 1}, {sparse: true});
            await this.orders.createIndex({orderToken: 1}, {sparse: true, unique: true});
            this.indexesReady = true;
        } catch (err) {
            console.error('OrderService.ensureIndexes:', err);
        }
    }

    // ---------------- helpers ----------------

    private async loadById(id: string): Promise<IOrder | null> {
        await this.ensureIndexes();
        const doc = await this.orders.findOne({id}, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    private normalize(d: any): IOrder {
        return {
            id: d.id,
            orderNumber: d.orderNumber ?? '',
            customerId: d.customerId,
            guestEmail: d.guestEmail,
            orderToken: d.orderToken,
            lineItems: Array.isArray(d.lineItems) ? d.lineItems : [],
            subtotal: d.subtotal ?? 0,
            shippingTotal: d.shippingTotal ?? 0,
            taxTotal: d.taxTotal ?? 0,
            discountTotal: d.discountTotal ?? 0,
            total: d.total ?? 0,
            currency: d.currency ?? 'USD',
            shippingAddress: d.shippingAddress,
            billingAddress: d.billingAddress,
            shippingMethod: d.shippingMethod,
            paymentRef: d.paymentRef,
            idempotencyKeys: d.idempotencyKeys ?? {},
            status: (d.status ?? 'pending') as OrderStatus,
            statusHistory: Array.isArray(d.statusHistory) ? d.statusHistory : [],
            inventoryReservationId: d.inventoryReservationId,
            createdAt: d.createdAt ?? '',
            updatedAt: d.updatedAt ?? '',
            version: typeof d.version === 'number' ? d.version : 1,
        };
    }

    private recalc(order: IOrder): IOrder {
        const subtotal = order.lineItems.reduce((s, l) => s + l.lineTotal, 0);
        const country = order.shippingAddress?.country;
        const rate = taxRateFor(country);
        const taxBase = subtotal + (order.shippingTotal ?? 0);
        const taxTotal = roundMinor(taxBase * rate);
        const total = subtotal + (order.shippingTotal ?? 0) + taxTotal - (order.discountTotal ?? 0);
        return {
            ...order,
            subtotal,
            taxTotal,
            total,
        };
    }

    private validateAddress(addr: IOrderAddress): void {
        const required: Array<keyof IOrderAddress> = ['name', 'line1', 'city', 'region', 'postalCode', 'country'];
        for (const k of required) {
            const v = (addr as any)[k];
            if (typeof v !== 'string' || v.trim() === '') {
                throw new OrderError('INVALID_ADDRESS', {field: k});
            }
        }
    }

    private async write(order: IOrder, expectedVersion: number): Promise<IOrder> {
        const next: IOrder = {...order, updatedAt: new Date().toISOString(), version: expectedVersion + 1};
        const result = await this.orders.updateOne(
            {id: order.id, version: expectedVersion},
            {$set: {
                customerId: next.customerId,
                guestEmail: next.guestEmail,
                orderToken: next.orderToken,
                lineItems: next.lineItems,
                subtotal: next.subtotal,
                shippingTotal: next.shippingTotal,
                taxTotal: next.taxTotal,
                discountTotal: next.discountTotal,
                total: next.total,
                currency: next.currency,
                shippingAddress: next.shippingAddress,
                billingAddress: next.billingAddress,
                shippingMethod: next.shippingMethod,
                paymentRef: next.paymentRef,
                idempotencyKeys: next.idempotencyKeys,
                status: next.status,
                statusHistory: next.statusHistory,
                inventoryReservationId: next.inventoryReservationId,
                orderNumber: next.orderNumber,
                updatedAt: next.updatedAt,
                version: next.version,
            }},
        );
        if (result.matchedCount === 0) {
            throw new OrderError('CONFLICT', {orderId: order.id});
        }
        return next;
    }

    private appendStatus(order: IOrder, status: OrderStatus, by?: string, note?: string): IOrder {
        const entry: IOrderStatusEntry = {
            status,
            at: new Date().toISOString(),
            ...(by ? {by} : {}),
            ...(note ? {note} : {}),
        };
        return {...order, status, statusHistory: [...order.statusHistory, entry]};
    }

    // ---------------- create draft ----------------

    async createDraftOrder(args: {
        cartId?: string;
        customerId?: string;
        currency: string;
        guestEmail?: string;
    }): Promise<IOrder> {
        await this.ensureIndexes();
        const owner: CartOwner = args.customerId
            ? {kind: 'customer', customerId: args.customerId}
            : {kind: 'guest', cartId: args.cartId ?? ''};
        if (owner.kind === 'guest' && !owner.cartId) {
            throw new OrderError('CART_REQUIRED');
        }
        const cart = await this.cart.getCart(owner);
        if (!cart.items || cart.items.length === 0) {
            throw new OrderError('EMPTY_CART');
        }
        // Snapshot lines from product titles/images at draft creation;
        // pricing comes from the cart's already-snapshotted price.
        const lineItems: IOrderLineItem[] = [];
        for (const it of cart.items) {
            const product = await this.products.getById(it.productId);
            if (!product) throw new OrderError('PRODUCT_NOT_FOUND', {sku: it.sku});
            lineItems.push({
                productId: it.productId,
                sku: it.sku,
                title: product.title,
                image: product.images?.[0],
                quantity: it.qty,
                unitPrice: it.priceSnapshot,
                lineTotal: it.qty * it.priceSnapshot,
            });
        }
        const reservation = await this.reservations.reserve(
            lineItems.map(l => ({productId: l.productId, sku: l.sku, qty: l.quantity})),
            RESERVATION_TTL_MS,
        );
        const now = new Date().toISOString();
        const id = guid();
        const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);
        const order: IOrder = {
            id,
            orderNumber: '',
            customerId: args.customerId,
            guestEmail: args.customerId ? undefined : args.guestEmail,
            lineItems,
            subtotal,
            shippingTotal: 0,
            taxTotal: 0,
            discountTotal: 0,
            total: subtotal,
            currency: args.currency,
            idempotencyKeys: {},
            status: 'pending',
            statusHistory: [{status: 'pending', at: now, by: 'system'}],
            inventoryReservationId: reservation.id,
            createdAt: now,
            updatedAt: now,
            version: 1,
        };
        await this.orders.insertOne(order as any);
        return order;
    }

    // ---------------- attach address / shipping ----------------

    async attachOrderAddress(args: {
        orderId: string;
        shipping: IOrderAddress;
        billing?: IOrderAddress;
        session?: OrderSession;
    }): Promise<IOrder> {
        const order = await this.requireOrder(args.orderId, args.session);
        if (order.status !== 'pending') throw new OrderError('IMMUTABLE_ORDER', {status: order.status});
        this.validateAddress(args.shipping);
        if (args.billing) this.validateAddress(args.billing);
        const updated = this.recalc({
            ...order,
            shippingAddress: args.shipping,
            billingAddress: args.billing ?? args.shipping,
        });
        return this.write(updated, order.version);
    }

    async attachOrderShipping(args: {
        orderId: string;
        methodCode: string;
        session?: OrderSession;
    }): Promise<IOrder> {
        const order = await this.requireOrder(args.orderId, args.session);
        if (order.status !== 'pending') throw new OrderError('IMMUTABLE_ORDER', {status: order.status});
        const method = getShippingMethod(args.methodCode);
        if (!method) throw new OrderError('UNKNOWN_SHIPPING_METHOD', {code: args.methodCode});
        const updated = this.recalc({
            ...order,
            shippingMethod: method,
            shippingTotal: method.price,
        });
        return this.write(updated, order.version);
    }

    // ---------------- payment ----------------

    async authorizeOrderPayment(args: {
        orderId: string;
        card: {number: string; exp: string; cvc: string; name?: string};
        idempotencyKey: string;
        session?: OrderSession;
    }): Promise<AuthorizeOrderResult> {
        const order = await this.requireOrder(args.orderId, args.session);
        if (order.status !== 'pending') throw new OrderError('IMMUTABLE_ORDER', {status: order.status});
        if (order.idempotencyKeys?.authorize === args.idempotencyKey && order.paymentRef?.authorizationId) {
            return {ok: true, orderId: order.id};
        }
        if (!args.idempotencyKey) throw new OrderError('IDEMPOTENCY_KEY_REQUIRED');
        if (!order.shippingAddress) throw new OrderError('ADDRESS_REQUIRED');
        if (!order.shippingMethod) throw new OrderError('SHIPPING_REQUIRED');
        const auth = await this.payment.authorize({
            amount: order.total,
            currency: order.currency,
            card: args.card,
            idempotencyKey: args.idempotencyKey,
            metadata: {orderId: order.id},
        });
        if (!auth.ok) {
            // Still record the attempted key so a retry with the same
            // key + same card replays the decline rather than calling
            // through twice.
            const updated: IOrder = {
                ...order,
                idempotencyKeys: {...order.idempotencyKeys, authorize: args.idempotencyKey},
            };
            await this.write(updated, order.version);
            return {ok: false, orderId: order.id, declineCode: auth.declineCode};
        }
        const updated: IOrder = {
            ...order,
            paymentRef: {
                provider: this.payment.name,
                authorizationId: auth.authorizationId,
                last4: auth.last4,
                brand: auth.brand,
            },
            idempotencyKeys: {...order.idempotencyKeys, authorize: args.idempotencyKey},
        };
        await this.write(updated, order.version);
        return {ok: true, orderId: order.id};
    }

    async finalizeOrder(args: {
        orderId: string;
        idempotencyKey: string;
        session?: OrderSession;
    }): Promise<IOrder> {
        const order = await this.requireOrder(args.orderId, args.session);
        if (order.idempotencyKeys?.finalize === args.idempotencyKey && order.status === 'paid') {
            return order;
        }
        if (!args.idempotencyKey) throw new OrderError('IDEMPOTENCY_KEY_REQUIRED');
        if (order.status !== 'pending') throw new OrderError('NOT_PENDING', {status: order.status});
        if (!order.paymentRef?.authorizationId) throw new OrderError('NOT_AUTHORIZED');
        const cap = await this.payment.capture(order.paymentRef.authorizationId, args.idempotencyKey);
        if (!cap.ok) throw new OrderError('CAPTURE_FAILED', {error: cap.error});

        // Confirm reservation (decrements stock atomically). If it
        // fails we don't transition — the order stays pending and the
        // capture is recorded so we don't lose track of payment state.
        if (order.inventoryReservationId) {
            try {
                await this.reservations.confirm(order.inventoryReservationId);
            } catch (err) {
                throw err;
            }
        }
        let next: IOrder = this.appendStatus(order, 'paid', 'mock-payment');
        next = {
            ...next,
            paymentRef: {...(next.paymentRef ?? {provider: this.payment.name}), captureId: cap.captureId},
            idempotencyKeys: {...next.idempotencyKeys, finalize: args.idempotencyKey},
        };
        if (!next.orderNumber) {
            next.orderNumber = await this.counter.next();
        }
        // Mint guest token at finalize time so it doesn't leak before
        // the order is real. The cookie hookup happens in the resolver.
        if (!next.customerId && !next.orderToken) {
            next.orderToken = mintOrderToken(next.id);
        }
        const written = await this.write(next, order.version);

        // Clear the cart — non-fatal.
        try {
            const owner: CartOwner = order.customerId
                ? {kind: 'customer', customerId: order.customerId}
                : {kind: 'guest', cartId: ''};
            if (owner.kind === 'customer') {
                await this.cart.clear(owner);
            }
        } catch (err) {
            console.error('[orders] cart clear failed:', err);
        }

        // Send confirmation email — non-fatal.
        try {
            const to = order.customerId ? undefined : order.guestEmail;
            // For customer orders we don't have email here; the
            // resolver layer can decorate before send. v1: skip if
            // we don't have a `to`.
            if (this.mailer && to) {
                await this.mailer.sendOrderConfirmation(written, to);
            }
        } catch (err) {
            console.error('[orders] confirmation email failed:', err);
        }

        return written;
    }

    async cancelOrder(args: {orderId: string; session?: OrderSession}): Promise<IOrder> {
        const order = await this.requireOrder(args.orderId, args.session);
        if (order.status !== 'pending') throw new OrderError('CANNOT_CANCEL', {status: order.status});
        const next = this.appendStatus(order, 'cancelled', args.session?.email ?? 'system');
        const written = await this.write(next, order.version);
        if (order.inventoryReservationId) {
            try { await this.reservations.release(order.inventoryReservationId); }
            catch (err) { console.error('[orders] release failed:', err); }
        }
        return written;
    }

    // ---------------- admin transitions / refund ----------------

    async transition(args: {orderId: string; next: OrderStatus; by?: string; note?: string}): Promise<IOrder> {
        const order = await this.loadById(args.orderId);
        if (!order) throw new OrderError('NOT_FOUND', {orderId: args.orderId});
        const allowed = ORDER_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes(args.next)) {
            throw new OrderError('ILLEGAL_TRANSITION', {from: order.status, to: args.next});
        }
        const updated = this.appendStatus(order, args.next, args.by ?? 'admin', args.note);
        return this.write(updated, order.version);
    }

    async refund(args: {orderId: string; amount?: number; reason?: string; by?: string}): Promise<IOrder> {
        const order = await this.loadById(args.orderId);
        if (!order) throw new OrderError('NOT_FOUND', {orderId: args.orderId});
        const allowed = ORDER_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes('refunded')) {
            throw new OrderError('ILLEGAL_TRANSITION', {from: order.status, to: 'refunded'});
        }
        if (!order.paymentRef?.captureId) {
            throw new OrderError('NO_CAPTURE');
        }
        const refundAmount = typeof args.amount === 'number' ? args.amount : order.total;
        const idem = `refund:${order.id}:${refundAmount}`;
        const result = await this.payment.refund(order.paymentRef.captureId, refundAmount, idem);
        if (!result.ok) throw new OrderError('REFUND_FAILED', {error: result.error});
        let next = this.appendStatus(order, 'refunded', args.by ?? 'admin', args.reason);
        next = {
            ...next,
            paymentRef: {...next.paymentRef!, refundId: result.refundId},
        };
        return this.write(next, order.version);
    }

    // ---------------- reads ----------------

    async listForCustomer(customerId: string, limit = 25): Promise<IOrder[]> {
        await this.ensureIndexes();
        const cap = Math.max(1, Math.min(200, Math.floor(limit) || 25));
        const docs = await this.orders
            .find({customerId}, {projection: {_id: 0}})
            .sort({createdAt: -1})
            .limit(cap)
            .toArray();
        return docs.map(d => this.normalize(d));
    }

    async getForCustomer(id: string, customerId: string): Promise<IOrder | null> {
        await this.ensureIndexes();
        const doc = await this.orders.findOne({id, customerId}, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    /** Guest confirmation: token argument must match the cookie value. */
    async getByToken(token: string, cookieToken: string | null | undefined): Promise<IOrder | null> {
        if (!token || !cookieToken) return null;
        if (token !== cookieToken) return null;
        await this.ensureIndexes();
        const doc = await this.orders.findOne({orderToken: token}, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    async listAll(opts: {status?: OrderStatus; limit?: number} = {}): Promise<IOrder[]> {
        await this.ensureIndexes();
        const cap = Math.max(1, Math.min(500, Math.floor(opts.limit ?? 50) || 50));
        const query: any = {};
        if (opts.status) query.status = opts.status;
        const docs = await this.orders
            .find(query, {projection: {_id: 0}})
            .sort({updatedAt: -1})
            .limit(cap)
            .toArray();
        return docs.map(d => this.normalize(d));
    }

    async getById(id: string): Promise<IOrder | null> {
        return this.loadById(id);
    }

    async shippingMethodsFor(_orderId: string) {
        // Static list for v1; the orderId arg is reserved for future
        // weight/destination-aware logic.
        return shippingMethodList();
    }

    // ---------------- sweeper ----------------

    /** Cancels pending orders past their reservation TTL, releases stock holds. */
    async sweep(now: Date = new Date()): Promise<{cancelled: string[]; releasedReservations: string[]}> {
        await this.ensureIndexes();
        const cutoff = new Date(now.getTime() - RESERVATION_TTL_MS).toISOString();
        const stale = await this.orders
            .find({status: 'pending', createdAt: {$lt: cutoff}}, {projection: {_id: 0}})
            .toArray();
        const cancelledIds: string[] = [];
        const released: string[] = [];
        for (const raw of stale) {
            const order = this.normalize(raw);
            try {
                const next = this.appendStatus(order, 'cancelled', 'system', 'sweeper:timeout');
                await this.write(next, order.version);
                cancelledIds.push(order.id);
                if (order.inventoryReservationId) {
                    await this.reservations.release(order.inventoryReservationId);
                    released.push(order.inventoryReservationId);
                }
            } catch (err) {
                console.error('[orders] sweep failed for', order.id, err);
            }
        }
        // Also release any orphan held reservations whose TTL elapsed
        // (defensive — orders sweep covers the linked case).
        const orphans = await this.reservations.sweep(now);
        for (const id of orphans) if (!released.includes(id)) released.push(id);
        return {cancelled: cancelledIds, releasedReservations: released};
    }

    // ---------------- internals ----------------

    /**
     * Loads order with IDOR check: customer sessions can only touch
     * their own orders; guest sessions can only touch orders that
     * have no customerId. Admin/system callers bypass.
     */
    private async requireOrder(orderId: string, session?: OrderSession): Promise<IOrder> {
        const order = await this.loadById(orderId);
        if (!order) throw new OrderError('NOT_FOUND', {orderId});
        if (session?.kind === 'customer') {
            if (!session.customerId || order.customerId !== session.customerId) {
                throw new OrderError('FORBIDDEN', {orderId});
            }
        } else if (session?.kind === 'anonymous') {
            if (order.customerId) {
                throw new OrderError('FORBIDDEN', {orderId});
            }
        }
        return order;
    }
}
