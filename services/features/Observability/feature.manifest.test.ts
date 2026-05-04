import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {observabilityFeature} from '@services/features/Observability/feature.manifest';
import {ErrorLogService} from '@services/features/Observability/ErrorLogService';

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
    db = client.db(`observability_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('observabilityFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(observabilityFeature.id).toBe('observability');
        expect(observabilityFeature.displayName).toBe('Observability');
    });

    it('services factory returns an `errorLog` key holding an ErrorLogService', () => {
        const built = observabilityFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['errorLog']);
        expect(built?.errorLog).toBeInstanceOf(ErrorLogService);
    });

    it('declares ErrorLog indexes mirrored from constructor createIndex calls', () => {
        const idxs = observabilityFeature.indexes ?? [];
        const ttl = idxs.find(i => (i.spec as any).ts === 1);
        expect(ttl?.options?.expireAfterSeconds).toBeGreaterThan(0);
        expect(idxs.some(i => (i.spec as any).source === 1)).toBe(true);
        expect(idxs.some(i => (i.spec as any).level === 1)).toBe(true);
    });

    it('contributes the getErrorLog SDL fragment (Phase C.2)', () => {
        expect(observabilityFeature.schemaSDL).toContain('extend type QueryMongo');
        expect(observabilityFeature.schemaSDL).toContain('getErrorLog');
    });

    it('omits resolvers and (currently) authz — getErrorLog has no tier requirement in legacy table', () => {
        expect(observabilityFeature.resolvers).toBeUndefined();
        expect(observabilityFeature.authz).toBeUndefined();
    });
});
