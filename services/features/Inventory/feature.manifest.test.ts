import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';

// The Inventory manifest pulls `getMongoConnection()` to bridge the
// adapter cache + resolver that still live on `MongoDBConnection`. In
// unit-test isolation we don't want to spin up the singleton (it
// connects to a real Atlas cluster on import), so stub it before the
// manifest module is imported.
vi.mock('@services/infra/mongoDBConnection', () => {
    return {
        getMongoConnection: () => ({
            resolveInventoryAdapter: () => ({
                id: 'mock',
                healthCheck: async () => ({ok: true}),
                fetchProducts: async () => ({items: [], nextCursor: null}),
            }),
        }),
    };
});

import {inventoryFeature} from '@services/features/Inventory/feature.manifest';
import {InventoryService} from '@services/features/Inventory/InventoryService';
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
    db = client.db(`inventory_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('inventoryFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(inventoryFeature.id).toBe('inventory');
        expect(inventoryFeature.displayName).toBe('Inventory');
    });

    it('declares requires:[\'products\'] so Products boots first', () => {
        // InventoryService takes ProductService in its ctor; the
        // topological sort seats Products before Inventory so
        // `ctx.services.products` is populated when this factory runs.
        expect(inventoryFeature.requires).toEqual(['products']);
    });

    it('services factory returns an `inventory` key holding an InventoryService', () => {
        const products = new ProductService(db);
        const redis = new InMemoryRedis();
        const built = inventoryFeature.services?.({db, redis, services: {products}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['inventory']);
        expect(built?.inventory).toBeInstanceOf(InventoryService);
    });

    it('throws if Products is missing from ctx.services (loud-fail rather than silent)', () => {
        const redis = new InMemoryRedis();
        expect(() => inventoryFeature.services?.({db, redis, services: {}, reconnect: async () => {}})).toThrow(/ProductService missing/);
    });

    it('declares the InventoryRuns + InventoryDeadLetters indexes mirrored from ensureIndexes()', () => {
        const idxs = inventoryFeature.indexes ?? [];
        const runStatus = idxs.find(i => i.collection === 'InventoryRuns' && (i.spec as any).status === 1);
        expect(runStatus).toBeDefined();
        const runStarted = idxs.find(i => i.collection === 'InventoryRuns' && (i.spec as any).startedAt === -1);
        expect(runStarted).toBeDefined();
        const runId = idxs.find(i => i.collection === 'InventoryRuns' && (i.spec as any).id === 1);
        expect(runId?.options?.unique).toBe(true);
        const dead = idxs.find(i => i.collection === 'InventoryDeadLetters' && (i.spec as any).externalId === 1);
        expect(dead?.options?.unique).toBe(true);
    });

    it('contributes the inventory SDL fragment (Phase C.2)', () => {
        expect(inventoryFeature.schemaSDL).toContain('inventoryStatus');
        expect(inventoryFeature.schemaSDL).toContain('inventoryReadDeadLetters');
        expect(inventoryFeature.schemaSDL).toContain('inventorySyncAll');
        expect(inventoryFeature.schemaSDL).toContain('inventorySyncDelta');
        expect(inventoryFeature.schemaSDL).toContain('inventorySaveAdapterConfig');
    });

    it('contributes admin authz entries + sync session injection', () => {
        expect(inventoryFeature.authz?.queryRequirements?.inventoryStatus).toBe('admin');
        expect(inventoryFeature.authz?.queryRequirements?.inventoryReadDeadLetters).toBe('admin');
        expect(inventoryFeature.authz?.mutationRequirements?.inventorySyncAll).toBe('admin');
        expect(inventoryFeature.authz?.mutationRequirements?.inventorySyncDelta).toBe('admin');
        expect(inventoryFeature.authz?.mutationRequirements?.inventorySaveAdapterConfig).toBe('admin');
        expect(inventoryFeature.authz?.sessionInjected).toContain('inventorySyncAll');
        expect(inventoryFeature.authz?.sessionInjected).toContain('inventorySyncDelta');
        expect(inventoryFeature.authz?.sessionInjected).toContain('inventorySaveAdapterConfig');
    });

    it('omits resolvers (inventory goes through guarded mongo proxy)', () => {
        expect(inventoryFeature.resolvers).toBeUndefined();
    });
});
