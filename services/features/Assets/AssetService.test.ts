import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {AssetService} from '@services/features/Assets/AssetService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let logos: Collection;
let images: Collection;
let service: AssetService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(() => {
    db = client.db(`asset_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    logos = db.collection('Logos');
    images = db.collection('Images');
    service = new AssetService(logos, images, async () => {});
});

describe('AssetService.saveLogo', () => {
    it('upserts a logo with id + type on first save', async () => {
        await service.saveLogo('{"src":"api/first.png","width":40,"height":40}', 'alice@example.com');
        const doc = await logos.findOne({}) as any;
        expect(doc).toBeTruthy();
        expect(typeof doc.id).toBe('string');
        expect(doc.id.length).toBeGreaterThan(0);
        expect(doc.type).toBe('image');
        expect(doc.content).toContain('api/first.png');
        expect(doc.editedBy).toBe('alice@example.com');
        expect(doc.editedAt).toBeTruthy();
    });

    it('updates the same doc on second save, keeping the original id', async () => {
        await service.saveLogo('{"src":"api/first.png"}', 'alice@example.com');
        const first = await logos.findOne({}) as any;
        await new Promise(r => setTimeout(r, 5));
        await service.saveLogo('{"src":"api/second.png"}', 'bob@example.com');
        const updated = await logos.findOne({}) as any;
        expect(updated.id).toBe(first.id);
        expect(updated.content).toContain('api/second.png');
        expect(updated.editedBy).toBe('bob@example.com');
        expect(new Date(updated.editedAt).getTime()).toBeGreaterThanOrEqual(new Date(first.editedAt).getTime());
    });
});

describe('AssetService.getLogo', () => {
    it('returns undefined when no logo exists', async () => {
        expect(await service.getLogo()).toBeUndefined();
    });

    it('back-fills missing id/type from legacy Mongo docs so GQL non-null checks pass', async () => {
        // Simulate a legacy row (predates the `id`/`type` fields).
        await logos.insertOne({content: '{"src":"api/legacy.png"}'} as any);
        const doc = await service.getLogo() as any;
        expect(doc.content).toContain('api/legacy.png');
        expect(typeof doc.id).toBe('string');
        expect(doc.type).toBe('image');
    });
});

describe('AssetService images', () => {
    it('saveImage + getImages (tag filter) + deleteImage round-trip', async () => {
        await service.saveImage({id: 'i1', name: 'a.png', location: 'api/a.png', type: 'image/png', size: 100, tags: ['hero', 'featured'], created: '2026-01-01'} as any);
        await service.saveImage({id: 'i2', name: 'b.png', location: 'api/b.png', type: 'image/png', size: 200, tags: ['gallery'], created: '2026-01-02'} as any);

        const hero = await service.getImages('hero');
        expect(hero).toHaveLength(1);
        expect(hero[0].id).toBe('i1');

        const gallery = await service.getImages('gallery');
        expect(gallery).toHaveLength(1);
        expect(gallery[0].id).toBe('i2');

        await service.deleteImage('i1');
        expect(await service.getImages('hero')).toHaveLength(0);
    });
});
