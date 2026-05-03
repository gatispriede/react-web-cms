import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {PostService} from './PostService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let posts: PostService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`posts_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    posts = new PostService(db);
});

describe('PostService.savePost — F2 pageId round-trip', () => {
    it('persists pageId on create and reads it back via getById', async () => {
        const {id} = await posts.save({
            slug: 'pinned',
            title: 'Pinned post',
            body: 'body',
            pageId: 'nav-services',
        } as any);
        const back = await posts.getById(id);
        expect(back?.pageId).toBe('nav-services');
    });

    it('omits pageId on create when not provided (unpinned default)', async () => {
        const {id} = await posts.save({slug: 'free', title: 'Free post', body: 'body'} as any);
        const back = await posts.getById(id);
        expect(back?.pageId).toBeUndefined();
    });

    it('updates pageId on edit (re-pin to a different page)', async () => {
        const {id} = await posts.save({
            slug: 'movable',
            title: 'Movable',
            body: 'body',
            pageId: 'nav-old',
        } as any);
        await posts.save({id, slug: 'movable', title: 'Movable', body: 'body', pageId: 'nav-new'} as any);
        const back = await posts.getById(id);
        expect(back?.pageId).toBe('nav-new');
    });

    it('clears pageId via $unset when saved with empty/undefined pageId', async () => {
        const {id} = await posts.save({
            slug: 'unpin-me',
            title: 'Unpin me',
            body: 'body',
            pageId: 'nav-x',
        } as any);
        await posts.save({id, slug: 'unpin-me', title: 'Unpin me', body: 'body'} as any);
        const back = await posts.getById(id);
        expect(back?.pageId).toBeUndefined();
        // Confirm the field is actually removed from the Mongo doc, not
        // just normalized away on read.
        const raw = await db.collection('Posts').findOne({id});
        expect((raw as any).pageId).toBeUndefined();
    });
});
