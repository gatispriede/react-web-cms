import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {productsFeature} from '@services/features/Products/feature.manifest';
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
    db = client.db(`products_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('productsFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(productsFeature.id).toBe('products');
        expect(productsFeature.displayName).toBe('Products');
    });

    it('omits `requires` (products is a leaf in the dep graph)', () => {
        // Cart / Order / Inventory depend on products, not the other way
        // around — see manifest header.
        expect(productsFeature.requires).toBeUndefined();
    });

    it('services factory returns a `products` key holding a ProductService', () => {
        const redis = new InMemoryRedis();
        const built = productsFeature.services?.({db, redis, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['products']);
        expect(built?.products).toBeInstanceOf(ProductService);
    });

    it('declares the Products collection indexes mirrored from ensureIndexes()', () => {
        const idxs = productsFeature.indexes ?? [];
        // All entries target the Products collection.
        for (const i of idxs) expect(i.collection).toBe('Products');
        const idIdx = idxs.find(i => i.spec.id === 1);
        expect(idIdx?.options?.unique).toBe(true);
        const slugIdx = idxs.find(i => i.spec.slug === 1);
        expect(slugIdx?.options?.unique).toBe(true);
        const skuIdx = idxs.find(i => i.spec.sku === 1);
        expect(skuIdx?.options?.unique).toBe(true);
    });

    it('declares externalId as a sparse unique index (warehouse-only field)', () => {
        // Sparse so manual products (no externalId) don't collide on the
        // unique constraint — see ProductService.ensureIndexes.
        const ext = (productsFeature.indexes ?? []).find(i => i.spec.externalId === 1);
        expect(ext).toBeDefined();
        expect(ext?.options?.unique).toBe(true);
        expect(ext?.options?.sparse).toBe(true);
    });

    it('contributes the products SDL fragment (Phase C.2)', () => {
        expect(productsFeature.schemaSDL).toContain('getProducts');
        expect(productsFeature.schemaSDL).toContain('getProduct');
        expect(productsFeature.schemaSDL).toContain('searchProducts');
        expect(productsFeature.schemaSDL).toContain('saveProduct');
        expect(productsFeature.schemaSDL).toContain('deleteProduct');
        expect(productsFeature.schemaSDL).toContain('setProductPublished');
    });

    it('contributes admin mutationRequirements + session injection', () => {
        expect(productsFeature.authz?.mutationRequirements?.saveProduct).toBe('admin');
        expect(productsFeature.authz?.mutationRequirements?.deleteProduct).toBe('admin');
        expect(productsFeature.authz?.mutationRequirements?.setProductPublished).toBe('admin');
        expect(productsFeature.authz?.sessionInjected).toContain('saveProduct');
        expect(productsFeature.authz?.sessionInjected).toContain('deleteProduct');
        expect(productsFeature.authz?.sessionInjected).toContain('setProductPublished');
    });

    it('omits resolvers (products goes through guarded mongo proxy)', () => {
        expect(productsFeature.resolvers).toBeUndefined();
    });
});
