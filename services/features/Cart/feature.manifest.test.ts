import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {cartFeature} from '@services/features/Cart/feature.manifest';
import {CartService} from '@services/features/Cart/CartService';
import {ProductService} from '@services/features/Products/ProductService';
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
    db = client.db(`cart_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('cartFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(cartFeature.id).toBe('cart');
        expect(cartFeature.displayName).toBe('Shopping cart');
    });

    it('declares requires:[\'products\'] so Products boots first', () => {
        // Products migrated in Phase B step 2; topological sort now seats
        // Products before Cart so `ctx.services.products` is populated by
        // the time this factory runs.
        expect(cartFeature.requires).toEqual(['products']);
    });

    it('services factory returns a `cart` key holding a CartService', () => {
        const products = new ProductService(db);
        const redis = new InMemoryRedis();
        const built = cartFeature.services?.({db, redis, services: {products}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['cart']);
        expect(built?.cart).toBeInstanceOf(CartService);
    });

    it('declares the Carts.customerId unique index', () => {
        expect(cartFeature.indexes).toBeDefined();
        const idx = (cartFeature.indexes ?? []).find(i => i.collection === 'Carts');
        expect(idx).toBeDefined();
        expect(idx?.spec).toEqual({customerId: 1});
        expect(idx?.options?.unique).toBe(true);
    });

    it('contributes the cart SDL fragment (mirror of schema.graphql)', () => {
        expect(cartFeature.schemaSDL).toContain('extend type QueryMongo');
        expect(cartFeature.schemaSDL).toContain('cart: String!');
        expect(cartFeature.schemaSDL).toContain('extend type MutationMongo');
        expect(cartFeature.schemaSDL).toContain('cartAddItem');
        expect(cartFeature.schemaSDL).toContain('cartUpdateQty');
        expect(cartFeature.schemaSDL).toContain('cartRemoveItem');
        expect(cartFeature.schemaSDL).toContain('cartClear');
    });

    it('contributes resolvers for cart query + four cart mutations', () => {
        const r = cartFeature.resolvers as {QueryMongo?: Record<string, unknown>; MutationMongo?: Record<string, unknown>};
        expect(typeof r.QueryMongo?.cart).toBe('function');
        expect(typeof r.MutationMongo?.cartAddItem).toBe('function');
        expect(typeof r.MutationMongo?.cartUpdateQty).toBe('function');
        expect(typeof r.MutationMongo?.cartRemoveItem).toBe('function');
        expect(typeof r.MutationMongo?.cartClear).toBe('function');
    });

    it('contributes an empty authz table (cart bypasses guardMethods)', () => {
        // Owner-based authz lives inline in the cart resolvers, not the
        // role/customer/anon tables. Empty contribution is the expected
        // shape — see manifest header authz comment.
        expect(cartFeature.authz).toBeDefined();
        expect(cartFeature.authz?.mutationRequirements).toBeUndefined();
        expect(cartFeature.authz?.customerMutations).toBeUndefined();
        expect(cartFeature.authz?.anonOpenMutations).toBeUndefined();
    });
});
