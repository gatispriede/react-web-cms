import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {bundleFeature} from '@services/features/Bundle/feature.manifest';
import {BundleService} from '@services/features/Bundle/BundleService';

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
    db = client.db(`bundle_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('bundleFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(bundleFeature.id).toBe('bundle');
        expect(bundleFeature.displayName).toBe('Bundle import/export');
    });

    it('services factory returns a `bundle` key holding a BundleService', () => {
        const built = bundleFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['bundle']);
        expect(built?.bundle).toBeInstanceOf(BundleService);
    });

    it('omits schemaSDL / resolvers / authz', () => {
        expect(bundleFeature.schemaSDL).toBeUndefined();
        expect(bundleFeature.resolvers).toBeUndefined();
        expect(bundleFeature.authz).toBeUndefined();
    });
});
