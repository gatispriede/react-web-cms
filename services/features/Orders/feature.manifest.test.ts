import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';

// The Orders manifest pulls `getMongoConnection()` for the resolver
// thunks (orderByToken cookie wiring) and the guest-checkout site-flag
// guard. In unit-test isolation we don't want to spin up the singleton
// (it connects to a real Atlas cluster on import), so stub it before
// the manifest module is imported. The factory itself doesn't read the
// connection — only the resolvers do — so a minimal stub suffices.
vi.mock('@services/infra/mongoDBConnection', () => {
    return {
        getMongoConnection: () => ({
            getSiteFlags: async () => JSON.stringify({allowGuestCheckout: true}),
            orderByToken: async () => null,
        }),
    };
});

import {ordersFeature} from '@services/features/Orders/feature.manifest';
import {OrderService} from '@services/features/Orders/OrderService';
import {StockReservationService} from '@services/features/Orders/StockReservationService';
import {ProductService} from '@services/features/Products/ProductService';
import {CartService} from '@services/features/Cart/CartService';
import {InMemoryRedis} from '@services/infra/redis';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(() => {
    db = client.db(`orders_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('ordersFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(ordersFeature.id).toBe('orders');
        expect(ordersFeature.displayName).toBe('Orders & checkout');
    });

    it('declares requires:[\'products\', \'cart\'] so both boot first', () => {
        // OrderService takes ProductService + CartService in its ctor;
        // StockReservationService takes ProductService. The topological
        // sort seats both before Orders so `ctx.services.{products,cart}`
        // are populated when this factory runs.
        expect(ordersFeature.requires).toEqual(['products', 'cart']);
    });

    it('services factory returns `orders` + `stockReservation` keys', () => {
        const products = new ProductService(db);
        const redis = new InMemoryRedis();
        const cart = new CartService(db, redis, products);
        const built = ordersFeature.services?.({db, redis, services: {products, cart}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built).sort()).toEqual(['orders', 'stockReservation']);
        expect(built?.orders).toBeInstanceOf(OrderService);
        expect(built?.stockReservation).toBeInstanceOf(StockReservationService);
    });

    it('throws if Products is missing from ctx.services (loud-fail)', () => {
        const redis = new InMemoryRedis();
        const products = new ProductService(db);
        const cart = new CartService(db, redis, products);
        expect(() => ordersFeature.services?.({db, redis, services: {cart}, reconnect: async () => {}})).toThrow(/ProductService missing/);
    });

    it('throws if Cart is missing from ctx.services (loud-fail)', () => {
        const products = new ProductService(db);
        const redis = new InMemoryRedis();
        expect(() => ordersFeature.services?.({db, redis, services: {products}, reconnect: async () => {}})).toThrow(/CartService missing/);
    });

    it('declares the Orders + StockReservations indexes mirrored from ensureIndexes()', () => {
        const idxs = ordersFeature.indexes ?? [];
        const orderId = idxs.find(i => i.collection === 'Orders' && (i.spec as any).id === 1);
        expect(orderId?.options?.unique).toBe(true);
        const orderNumber = idxs.find(i => i.collection === 'Orders' && (i.spec as any).orderNumber === 1);
        expect(orderNumber?.options?.unique).toBe(true);
        expect(orderNumber?.options?.sparse).toBe(true);
        const orderToken = idxs.find(i => i.collection === 'Orders' && (i.spec as any).orderToken === 1);
        expect(orderToken?.options?.unique).toBe(true);
        expect(orderToken?.options?.sparse).toBe(true);
        const reservationId = idxs.find(i => i.collection === 'StockReservations' && (i.spec as any).id === 1);
        expect(reservationId?.options?.unique).toBe(true);
        const reservationStatus = idxs.find(i => i.collection === 'StockReservations' && (i.spec as any).status === 1);
        expect(reservationStatus).toBeDefined();
    });

    it('contributes the six checkout-flow resolvers + orderByToken query', () => {
        const r = ordersFeature.resolvers as {
            QueryMongo?: Record<string, unknown>;
            MutationMongo?: Record<string, unknown>;
        };
        expect(typeof r.QueryMongo?.orderByToken).toBe('function');
        expect(typeof r.MutationMongo?.createDraftOrder).toBe('function');
        expect(typeof r.MutationMongo?.attachOrderAddress).toBe('function');
        expect(typeof r.MutationMongo?.attachOrderShipping).toBe('function');
        expect(typeof r.MutationMongo?.authorizeOrderPayment).toBe('function');
        expect(typeof r.MutationMongo?.finalizeOrder).toBe('function');
        expect(typeof r.MutationMongo?.cancelOrder).toBe('function');
    });

    it('contributes the orders SDL fragment (Phase C.2)', () => {
        const sdl = ordersFeature.schemaSDL ?? '';
        expect(sdl).toContain('myOrders');
        expect(sdl).toContain('myOrder');
        expect(sdl).toContain('orderByToken');
        expect(sdl).toContain('adminOrders');
        expect(sdl).toContain('adminOrder');
        expect(sdl).toContain('shippingMethodsFor');
        expect(sdl).toContain('createDraftOrder');
        expect(sdl).toContain('attachOrderAddress');
        expect(sdl).toContain('attachOrderShipping');
        expect(sdl).toContain('authorizeOrderPayment');
        expect(sdl).toContain('finalizeOrder');
        expect(sdl).toContain('cancelOrder');
        expect(sdl).toContain('adminTransitionOrder');
        expect(sdl).toContain('adminRefundOrder');
    });

    it('contributes admin/editor + customer + anon authz entries', () => {
        const a = ordersFeature.authz!;
        expect(a.mutationRequirements?.adminTransitionOrder).toBe('editor');
        expect(a.mutationRequirements?.adminRefundOrder).toBe('admin');
        expect(a.queryRequirements?.adminOrders).toBe('editor');
        expect(a.queryRequirements?.adminOrder).toBe('editor');
        expect(a.queryRequirements?.shippingMethodsFor).toBe('editor');
        expect(a.customerMutations).toEqual(expect.arrayContaining([
            'createDraftOrder', 'attachOrderAddress', 'attachOrderShipping',
            'authorizeOrderPayment', 'finalizeOrder', 'cancelOrder',
        ]));
        expect(a.customerQueries).toEqual(expect.arrayContaining(['myOrders', 'myOrder']));
        expect(a.anonOpenMutations).toEqual(expect.arrayContaining([
            'createDraftOrder', 'attachOrderAddress', 'attachOrderShipping',
            'authorizeOrderPayment', 'finalizeOrder', 'cancelOrder',
        ]));
        expect(a.sessionInjected).toContain('adminTransitionOrder');
        expect(a.sessionInjected).toContain('adminRefundOrder');
    });
});
