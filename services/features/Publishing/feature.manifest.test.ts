import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {publishingFeature} from '@services/features/Publishing/feature.manifest';
import {PublishService} from '@services/features/Publishing/PublishService';

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
    db = client.db(`publishing_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('publishingFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(publishingFeature.id).toBe('publishing');
        expect(publishingFeature.displayName).toBe('Publishing');
    });

    it('services factory returns a `publish` key holding a PublishService', () => {
        const built = publishingFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['publish']);
        expect(built?.publish).toBeInstanceOf(PublishService);
    });

    it('contributes the publishing SDL fragment (Phase C.2)', () => {
        expect(publishingFeature.schemaSDL).toContain('getPublishedSnapshot');
        expect(publishingFeature.schemaSDL).toContain('getPublishedMeta');
        expect(publishingFeature.schemaSDL).toContain('getPublishedHistory');
        expect(publishingFeature.schemaSDL).toContain('publishSnapshot');
        expect(publishingFeature.schemaSDL).toContain('rollbackToSnapshot');
    });

    it('contributes editor mutationRequirements + canPublishProduction capability + session injection', () => {
        expect(publishingFeature.authz?.mutationRequirements?.publishSnapshot).toBe('editor');
        expect(publishingFeature.authz?.mutationRequirements?.rollbackToSnapshot).toBe('editor');
        expect(publishingFeature.authz?.capabilities?.publishSnapshot).toBe('canPublishProduction');
        expect(publishingFeature.authz?.capabilities?.rollbackToSnapshot).toBe('canPublishProduction');
        expect(publishingFeature.authz?.sessionInjected).toContain('publishSnapshot');
        expect(publishingFeature.authz?.sessionInjected).toContain('rollbackToSnapshot');
    });

    it('omits resolvers (publishing goes through guarded mongo proxy)', () => {
        expect(publishingFeature.resolvers).toBeUndefined();
    });
});
