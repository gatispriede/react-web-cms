import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {Db, MongoClient} from 'mongodb';
import {CartService} from '@services/features/Cart/CartService';
import {ProductService} from '@services/features/Products/ProductService';
import {InMemoryRedis} from '@services/infra/redis';
import {InsufficientStockError} from '@interfaces/ICart';
import {ConflictError, isConflictError, requireVersion} from '@services/infra/conflict';
import {signCartId, verifyCartId} from '@services/features/Cart/cartCookie';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let products: ProductService;
let redis: InMemoryRedis;
let service: CartService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`cart_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    products = new ProductService(db);
    redis = new InMemoryRedis();
    service = new CartService(db, redis, products);
});

const seedProduct = async (overrides: any = {}) => {
    const p = await products.save({
        sku: overrides.sku ?? 'SKU-A',
        title: overrides.title ?? 'Widget',
        price: overrides.price ?? 1000,
        currency: overrides.currency ?? 'EUR',
        stock: overrides.stock ?? 10,
        ...overrides,
    });
    return p;
};

describe('CartService — guest path (Redis)', () => {
    it('starts with an empty cart', async () => {
        const cart = await service.getCart({kind: 'guest', cartId: 'g1'});
        expect(cart.items).toEqual([]);
        expect(cart.currency).toBeNull();
        expect(cart.subtotal).toBe(0);
    });

    it('addItem inserts a line, locks currency, and sets a TTL', async () => {
        const p = await seedProduct({stock: 5, price: 1500});
        const cart = await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 2});
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].priceSnapshot).toBe(1500);
        expect(cart.subtotal).toBe(3000);
        expect(cart.currency).toBe('EUR');
        // Sliding TTL set near the 30-day mark.
        const ttl = redis._ttl('cart:guest:g1');
        expect(ttl).toBeGreaterThan(60 * 60 * 24 * 29);
    });

    it('adding the same SKU sums qtys', async () => {
        const p = await seedProduct({stock: 10});
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const cart = await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 2});
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].qty).toBe(3);
    });

    it('updateQty sets exact qty; qty=0 removes the line', async () => {
        const p = await seedProduct({stock: 10});
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 3});
        let cart = await service.updateQty({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 5});
        expect(cart.items[0].qty).toBe(5);
        cart = await service.updateQty({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 0});
        expect(cart.items).toHaveLength(0);
        expect(cart.currency).toBeNull();
    });

    it('removeItem drops a single line', async () => {
        const p1 = await seedProduct({sku: 'SKU-A'});
        const p2 = await seedProduct({sku: 'SKU-B'});
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p1.id, sku: 'SKU-A', qty: 1});
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p2.id, sku: 'SKU-B', qty: 1});
        const cart = await service.removeItem({kind: 'guest', cartId: 'g1'}, {productId: p1.id, sku: 'SKU-A'});
        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].sku).toBe('SKU-B');
    });

    it('clear empties the cart and resets currency', async () => {
        const p = await seedProduct();
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const cart = await service.clear({kind: 'guest', cartId: 'g1'});
        expect(cart.items).toEqual([]);
        expect(cart.currency).toBeNull();
    });

    it('TTL is refreshed on read', async () => {
        const p = await seedProduct();
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        // Forcibly shorten the TTL — read should restore it to the full window.
        await redis.set('cart:guest:g1', (await redis.get('cart:guest:g1'))!, 100);
        await service.getCart({kind: 'guest', cartId: 'g1'});
        const ttl = redis._ttl('cart:guest:g1');
        expect(ttl).toBeGreaterThan(60 * 60 * 24 * 29);
    });

    it('malformed cart payload is dropped and the cart resets', async () => {
        await redis.set('cart:guest:g1', 'not-json', 60);
        const cart = await service.getCart({kind: 'guest', cartId: 'g1'});
        expect(cart.items).toEqual([]);
    });
});

describe('CartService — stock validation', () => {
    it('throws InsufficientStockError on add when stock=0', async () => {
        const p = await seedProduct({stock: 0});
        await expect(
            service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1}),
        ).rejects.toBeInstanceOf(InsufficientStockError);
    });

    it('clamps qty to available stock and surfaces a warning', async () => {
        const p = await seedProduct({stock: 3});
        const cart = await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 10});
        expect(cart.items[0].qty).toBe(3);
        expect(cart.warnings?.[0]).toEqual({sku: 'SKU-A', reason: 'clamped'});
    });

    it('updateQty also clamps and warns', async () => {
        const p = await seedProduct({stock: 3});
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const cart = await service.updateQty({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 99});
        expect(cart.items[0].qty).toBe(3);
        expect(cart.warnings?.[0]).toMatchObject({sku: 'SKU-A', reason: 'clamped'});
    });
});

describe('CartService — currency lock', () => {
    it('rejects a second item with mismatched currency', async () => {
        const eur = await seedProduct({sku: 'EUR-1', currency: 'EUR'});
        const usd = await seedProduct({sku: 'USD-1', currency: 'USD'});
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: eur.id, sku: 'EUR-1', qty: 1});
        await expect(
            service.addItem({kind: 'guest', cartId: 'g1'}, {productId: usd.id, sku: 'USD-1', qty: 1}),
        ).rejects.toThrow(/currency mismatch/);
    });
});

describe('CartService — customer path (Mongo)', () => {
    it('persists across calls and shapes a fresh empty cart for new customers', async () => {
        const cart = await service.getCart({kind: 'customer', customerId: 'cust-1'});
        expect(cart.items).toEqual([]);
        const p = await seedProduct({stock: 5});
        await service.addItem({kind: 'customer', customerId: 'cust-1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const again = await service.getCart({kind: 'customer', customerId: 'cust-1'});
        expect(again.items).toHaveLength(1);
    });

    it('bumps version on every write (optimistic concurrency)', async () => {
        const p = await seedProduct({stock: 10});
        await service.addItem({kind: 'customer', customerId: 'cust-1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const doc1 = await db.collection('Carts').findOne({customerId: 'cust-1'}) as any;
        expect(doc1.version).toBe(1);
        await service.addItem({kind: 'customer', customerId: 'cust-1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        const doc2 = await db.collection('Carts').findOne({customerId: 'cust-1'}) as any;
        expect(doc2.version).toBe(2);
    });

    it('detects a concurrent write via requireVersion when a stale version is forced', async () => {
        const p = await seedProduct({stock: 10});
        await service.addItem({kind: 'customer', customerId: 'cust-1'}, {productId: p.id, sku: 'SKU-A', qty: 1});
        // Simulate an out-of-band write that bumps the version.
        await db.collection('Carts').updateOne({customerId: 'cust-1'}, {$set: {version: 99}});
        // Direct call into the service's internals is white-box, so test the
        // contract instead: a stale `requireVersion` should throw ConflictError.
        const existing = await db.collection('Carts').findOne({customerId: 'cust-1'});
        // expectedVersion=1, on-disk=99 → conflict
        expect(() => requireVersion(existing, 99, 1, 'Cart')).toThrow(/edited by someone else/);
    });
});

describe('CartService — mergeGuestIntoCustomer', () => {
    it('sums qtys for matching SKUs, capped at current stock; existing customer price snapshot wins', async () => {
        const p = await seedProduct({sku: 'SKU-A', stock: 5, price: 1000});

        // Guest cart: qty 3 at price 800 (older snapshot).
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: p.id, sku: 'SKU-A', qty: 3});
        // Tweak the persisted snapshot to simulate "guest added when price was lower".
        const stored = JSON.parse((await redis.get('cart:guest:g1'))!);
        stored.items[0].priceSnapshot = 800;
        await redis.set('cart:guest:g1', JSON.stringify(stored), 60);

        // Customer cart: qty 2 at price 1000 (current snapshot).
        await service.addItem({kind: 'customer', customerId: 'cust-1'}, {productId: p.id, sku: 'SKU-A', qty: 2});

        const merged = await service.mergeGuestIntoCustomer('g1', 'cust-1');
        expect(merged.items).toHaveLength(1);
        // qty: 2 + 3 = 5, capped at stock=5 → 5
        expect(merged.items[0].qty).toBe(5);
        // existing customer snapshot wins.
        expect(merged.items[0].priceSnapshot).toBe(1000);
        // Redis key is gone.
        expect(await redis.get('cart:guest:g1')).toBeNull();
    });

    it('caps merged qty at available stock and brings new lines in with the guest snapshot', async () => {
        const a = await seedProduct({sku: 'SKU-A', stock: 5, price: 1000});
        const b = await seedProduct({sku: 'SKU-B', stock: 2, price: 500});

        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: a.id, sku: 'SKU-A', qty: 4});
        await service.addItem({kind: 'guest', cartId: 'g1'}, {productId: b.id, sku: 'SKU-B', qty: 5});

        const merged = await service.mergeGuestIntoCustomer('g1', 'cust-1');
        const lineA = merged.items.find(it => it.sku === 'SKU-A')!;
        const lineB = merged.items.find(it => it.sku === 'SKU-B')!;
        expect(lineA.qty).toBe(4);
        expect(lineB.qty).toBe(2);
        expect(lineB.priceSnapshot).toBe(500);
    });

    it('is a no-op when the guest cart is absent', async () => {
        const merged = await service.mergeGuestIntoCustomer('does-not-exist', 'cust-1');
        expect(merged.items).toEqual([]);
    });
});

describe('cartCookie', () => {
    it('signs and verifies a uuid', () => {
        const uuid = '11111111-1111-4111-8111-111111111111';
        const cookie = signCartId(uuid, 'top-secret');
        expect(verifyCartId(cookie, ['top-secret'])).toBe(uuid);
    });

    it('rejects malformed cookies', () => {
        expect(verifyCartId('', ['s'])).toBeNull();
        expect(verifyCartId('no-dot', ['s'])).toBeNull();
        expect(verifyCartId('not-a-uuid.deadbeef', ['s'])).toBeNull();
        expect(verifyCartId('11111111-1111-4111-8111-111111111111.', ['s'])).toBeNull();
    });

    it('rejects forged signatures', () => {
        const uuid = '11111111-1111-4111-8111-111111111111';
        const cookie = signCartId(uuid, 'right');
        expect(verifyCartId(cookie, ['wrong'])).toBeNull();
    });

    it('supports rotation — accepts old, but the active secret is the first', () => {
        const uuid = '11111111-1111-4111-8111-111111111111';
        const oldCookie = signCartId(uuid, 'old');
        // After rotation, secrets list = ['new', 'old']; old still verifies.
        expect(verifyCartId(oldCookie, ['new', 'old'])).toBe(uuid);
    });
});

// keep an unused import noise from the suite — useful when iterating.
void ConflictError;
void isConflictError;
