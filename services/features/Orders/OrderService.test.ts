import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {Db, MongoClient} from 'mongodb';
import {OrderService} from '@services/features/Orders/OrderService';
import {StockReservationService} from '@services/features/Orders/StockReservationService';
import {MockPaymentProvider} from '@services/features/Orders/payment/MockPaymentProvider';
import {ProductService} from '@services/features/Products/ProductService';
import {CartService} from '@services/features/Cart/CartService';
import {InMemoryRedis} from '@services/infra/redis';
import type {OrderMailer} from '@services/features/Orders/OrderService';
import {OrderError} from '@interfaces/IOrder';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let products: ProductService;
let cart: CartService;
let redis: InMemoryRedis;
let reservations: StockReservationService;
let payment: MockPaymentProvider;
let mailer: OrderMailer & {sendOrderConfirmation: ReturnType<typeof vi.fn>};
let service: OrderService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`orders_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    products = new ProductService(db);
    redis = new InMemoryRedis();
    cart = new CartService(db, redis, products);
    reservations = new StockReservationService(db, products);
    payment = new MockPaymentProvider();
    mailer = {sendOrderConfirmation: vi.fn(async () => {})};
    service = new OrderService(db, products, cart, reservations, payment, mailer);
});

const seedProduct = async (overrides: any = {}) => {
    return products.save({
        sku: overrides.sku ?? 'SKU-A',
        title: overrides.title ?? 'Widget',
        price: overrides.price ?? 1000,
        currency: overrides.currency ?? 'USD',
        stock: overrides.stock ?? 10,
        ...overrides,
    });
};

const goodCard = {number: '4242424242424242', exp: '12/30', cvc: '123', name: 'Test'};
const badCard = {number: '4000000000000002', exp: '12/30', cvc: '123', name: 'Test'};

const usAddress = {
    name: 'Alice', line1: '1 Main St', city: 'NYC', region: 'NY',
    postalCode: '10001', country: 'US',
};

describe('OrderService — happy path', () => {
    it('creates a draft, attaches address + shipping, authorises, finalises', async () => {
        const p = await seedProduct({stock: 5, price: 1500});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 2});

        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD', guestEmail: 'a@b.com'});
        expect(draft.status).toBe('pending');
        expect(draft.lineItems).toHaveLength(1);
        expect(draft.subtotal).toBe(3000);
        expect(draft.inventoryReservationId).toBeTruthy();

        const withAddr = await service.attachOrderAddress({orderId: draft.id, shipping: usAddress});
        expect(withAddr.shippingAddress?.country).toBe('US');
        expect(withAddr.taxTotal).toBe(0); // US rate = 0

        const withShip = await service.attachOrderShipping({orderId: draft.id, methodCode: 'standard'});
        expect(withShip.shippingTotal).toBe(500);
        expect(withShip.total).toBe(3500);

        const auth = await service.authorizeOrderPayment({orderId: draft.id, card: goodCard, idempotencyKey: 'auth-1'});
        expect(auth.ok).toBe(true);

        const finalized = await service.finalizeOrder({orderId: draft.id, idempotencyKey: 'fin-1'});
        expect(finalized.status).toBe('paid');
        expect(finalized.orderNumber).toMatch(/^ORD-\d{4}-\d{6}$/);
        expect(finalized.paymentRef?.captureId).toMatch(/^mock_cap_/);

        // Reservation confirmed; product stock decremented to 3.
        const refreshed = await products.getById(p.id);
        expect(refreshed?.stock).toBe(3);

        // Email queued.
        expect(mailer.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    });

    it('applies LV tax rate (21%) on subtotal + shipping', async () => {
        const p = await seedProduct({stock: 5, price: 10000, currency: 'USD'});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD'});
        await service.attachOrderAddress({orderId: draft.id, shipping: {...usAddress, country: 'LV'}});
        const withShip = await service.attachOrderShipping({orderId: draft.id, methodCode: 'standard'});
        // (10000 + 500) * 0.21 = 2205
        expect(withShip.taxTotal).toBe(2205);
        expect(withShip.total).toBe(10000 + 500 + 2205);
    });

    it('finalize is idempotent on the same key', async () => {
        const p = await seedProduct({stock: 5});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD'});
        await service.attachOrderAddress({orderId: draft.id, shipping: usAddress});
        await service.attachOrderShipping({orderId: draft.id, methodCode: 'standard'});
        await service.authorizeOrderPayment({orderId: draft.id, card: goodCard, idempotencyKey: 'a'});
        const captureSpy = vi.spyOn(payment, 'capture');
        const a = await service.finalizeOrder({orderId: draft.id, idempotencyKey: 'fin'});
        const b = await service.finalizeOrder({orderId: draft.id, idempotencyKey: 'fin'});
        expect(a.id).toBe(b.id);
        expect(b.status).toBe('paid');
        // The provider's internal idempotency cache means the second
        // call would reuse its own cached capture even if reached;
        // here the service early-returns before calling.
        expect(captureSpy).toHaveBeenCalledTimes(1);
    });

    it('authorize with declined card keeps order pending; retry with good card succeeds', async () => {
        const p = await seedProduct({stock: 5});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD'});
        await service.attachOrderAddress({orderId: draft.id, shipping: usAddress});
        await service.attachOrderShipping({orderId: draft.id, methodCode: 'standard'});
        const declined = await service.authorizeOrderPayment({orderId: draft.id, card: badCard, idempotencyKey: 'd1'});
        expect(declined.ok).toBe(false);
        expect(declined.declineCode).toBe('card_declined');
        const after = await service.getById(draft.id);
        expect(after?.status).toBe('pending');
        // Reservation still held — product stock not yet decremented.
        const product = await products.getById(p.id);
        expect(product?.stock).toBe(5);

        const ok = await service.authorizeOrderPayment({orderId: draft.id, card: goodCard, idempotencyKey: 'd2'});
        expect(ok.ok).toBe(true);
    });
});

describe('OrderService — sweep', () => {
    it('cancels stale pending orders and releases reservations', async () => {
        const p = await seedProduct({stock: 3});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD'});
        // Fast-forward clock 1 hour past createdAt.
        const future = new Date(Date.now() + 60 * 60 * 1000);
        const result = await service.sweep(future);
        expect(result.cancelled).toContain(draft.id);
        const after = await service.getById(draft.id);
        expect(after?.status).toBe('cancelled');
        const reservation = await reservations.getById(draft.inventoryReservationId!);
        expect(reservation?.status).toBe('released');
    });
});

describe('OrderService — IDOR', () => {
    it('customer A cannot read customer B order', async () => {
        const p = await seedProduct({stock: 5});
        // Two carts under different customer ids.
        await cart.addItem({kind: 'customer', customerId: 'A'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const draftA = await service.createDraftOrder({customerId: 'A', currency: 'USD'});
        const found = await service.getForCustomer(draftA.id, 'A');
        expect(found?.id).toBe(draftA.id);
        const otherRead = await service.getForCustomer(draftA.id, 'B');
        expect(otherRead).toBeNull();
    });

    it('guest token mismatch is rejected', async () => {
        const p = await seedProduct({stock: 5});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD', guestEmail: 'a@b.com'});
        await service.attachOrderAddress({orderId: draft.id, shipping: usAddress});
        await service.attachOrderShipping({orderId: draft.id, methodCode: 'standard'});
        await service.authorizeOrderPayment({orderId: draft.id, card: goodCard, idempotencyKey: 'a'});
        const finalized = await service.finalizeOrder({orderId: draft.id, idempotencyKey: 'f'});
        const token = finalized.orderToken!;
        expect(token).toBeTruthy();
        const ok = await service.getByToken(token, token);
        expect(ok?.id).toBe(finalized.id);
        const bad = await service.getByToken(token, 'wrong');
        expect(bad).toBeNull();
    });
});

describe('OrderService — state machine', () => {
    const setupPaid = async () => {
        const p = await seedProduct({stock: 5});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD'});
        await service.attachOrderAddress({orderId: draft.id, shipping: usAddress});
        await service.attachOrderShipping({orderId: draft.id, methodCode: 'standard'});
        await service.authorizeOrderPayment({orderId: draft.id, card: goodCard, idempotencyKey: 'a'});
        await service.finalizeOrder({orderId: draft.id, idempotencyKey: 'f'});
        return draft.id;
    };

    it('legal transitions: paid → fulfilling → shipped → delivered', async () => {
        const id = await setupPaid();
        const f = await service.transition({orderId: id, next: 'fulfilling', by: 'admin@x'});
        expect(f.status).toBe('fulfilling');
        const s = await service.transition({orderId: id, next: 'shipped', by: 'admin@x'});
        expect(s.status).toBe('shipped');
        const d = await service.transition({orderId: id, next: 'delivered', by: 'admin@x'});
        expect(d.status).toBe('delivered');
        expect(d.statusHistory.map(e => e.status)).toEqual([
            'pending', 'paid', 'fulfilling', 'shipped', 'delivered',
        ]);
    });

    it('illegal transition throws', async () => {
        const id = await setupPaid();
        await expect(service.transition({orderId: id, next: 'pending'})).rejects.toBeInstanceOf(OrderError);
        await service.transition({orderId: id, next: 'fulfilling'});
        await expect(service.transition({orderId: id, next: 'paid'})).rejects.toBeInstanceOf(OrderError);
    });

    it('admin refund transitions paid → refunded with refundId', async () => {
        const id = await setupPaid();
        const refunded = await service.refund({orderId: id, by: 'admin@x', reason: 'customer request'});
        expect(refunded.status).toBe('refunded');
        expect(refunded.paymentRef?.refundId).toMatch(/^mock_rfn_/);
    });
});

describe('OrderService — cart + reservation guards', () => {
    it('createDraftOrder throws OUT_OF_STOCK when reservation can\'t be held', async () => {
        const p = await seedProduct({stock: 1});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        // Manually decrement stock via a phantom write to simulate
        // contention before reservation.
        await db.collection('Products').updateOne({id: p.id}, {$set: {stock: 0}});
        await expect(
            service.createDraftOrder({cartId: 'g1', currency: 'USD'}),
        ).rejects.toBeInstanceOf(OrderError);
    });

    it('cancelOrder releases reservation', async () => {
        const p = await seedProduct({stock: 5});
        await cart.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 2});
        const draft = await service.createDraftOrder({cartId: 'g1', currency: 'USD'});
        const cancelled = await service.cancelOrder({orderId: draft.id});
        expect(cancelled.status).toBe('cancelled');
        const reservation = await reservations.getById(draft.inventoryReservationId!);
        expect(reservation?.status).toBe('released');
    });
});
