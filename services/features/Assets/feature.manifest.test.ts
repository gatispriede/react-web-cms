import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {assetsFeature} from '@services/features/Assets/feature.manifest';
import {AssetService} from '@services/features/Assets/AssetService';

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
    db = client.db(`assets_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('assetsFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(assetsFeature.id).toBe('assets');
        expect(assetsFeature.displayName).toBe('Assets');
    });

    it('does not declare requires', () => {
        expect(assetsFeature.requires).toBeUndefined();
    });

    it('services factory returns an `assets` key holding an AssetService', () => {
        const built = assetsFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['assets']);
        expect(built?.assets).toBeInstanceOf(AssetService);
    });

    it('contributes the assets SDL fragment (Phase C.2)', () => {
        expect(assetsFeature.schemaSDL).toContain('getImages');
        expect(assetsFeature.schemaSDL).toContain('getLogo');
        expect(assetsFeature.schemaSDL).toContain('saveImage');
        expect(assetsFeature.schemaSDL).toContain('deleteImage');
        expect(assetsFeature.schemaSDL).toContain('saveLogo');
    });

    it('contributes editor mutationRequirements + saveLogo session injection', () => {
        expect(assetsFeature.authz?.mutationRequirements?.saveImage).toBe('editor');
        expect(assetsFeature.authz?.mutationRequirements?.deleteImage).toBe('editor');
        expect(assetsFeature.authz?.mutationRequirements?.saveLogo).toBe('editor');
        expect(assetsFeature.authz?.sessionInjected).toContain('saveLogo');
    });

    it('omits resolvers (assets reads/writes go through guarded mongo proxy)', () => {
        expect(assetsFeature.resolvers).toBeUndefined();
    });
});
