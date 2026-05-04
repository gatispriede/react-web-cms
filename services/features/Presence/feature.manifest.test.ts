import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {presenceFeature} from '@services/features/Presence/feature.manifest';
import {PresenceService} from '@services/features/Presence/PresenceService';

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
    db = client.db(`presence_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('presenceFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(presenceFeature.id).toBe('presence');
        expect(presenceFeature.displayName).toBe('Presence');
    });

    it('services factory returns a `presence` key holding a PresenceService', () => {
        const built = presenceFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['presence']);
        expect(built?.presence).toBeInstanceOf(PresenceService);
    });

    it('declares the Presence indexes mirrored from ensureIndexes()', () => {
        const idxs = presenceFeature.indexes ?? [];
        const unique = idxs.find(i => (i.spec as any).email === 1 && (i.spec as any).docId === 1);
        expect(unique?.options?.unique).toBe(true);
        const ttl = idxs.find(i => (i.spec as any).at === 1);
        expect(ttl?.options?.expireAfterSeconds).toBeGreaterThan(0);
    });

    it('omits schemaSDL / resolvers / authz', () => {
        expect(presenceFeature.schemaSDL).toBeUndefined();
        expect(presenceFeature.resolvers).toBeUndefined();
        expect(presenceFeature.authz).toBeUndefined();
    });
});
