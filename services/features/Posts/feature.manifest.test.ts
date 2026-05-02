import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {postsFeature} from '@services/features/Posts/feature.manifest';
import {PostService} from '@services/features/Posts/PostService';

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
    db = client.db(`posts_manifest_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('postsFeature manifest', () => {
    it('declares stable id and displayName', () => {
        expect(postsFeature.id).toBe('posts');
        expect(postsFeature.displayName).toBe('Posts');
    });

    it('does not declare requires', () => {
        expect(postsFeature.requires).toBeUndefined();
    });

    it('services factory returns a `posts` key holding a PostService', () => {
        const built = postsFeature.services?.({db, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['posts']);
        expect(built?.posts).toBeInstanceOf(PostService);
    });

    it('contributes the posts SDL fragment (Phase C.2)', () => {
        expect(postsFeature.schemaSDL).toContain('getPosts');
        expect(postsFeature.schemaSDL).toContain('getPost');
        expect(postsFeature.schemaSDL).toContain('savePost');
        expect(postsFeature.schemaSDL).toContain('deletePost');
        expect(postsFeature.schemaSDL).toContain('setPostPublished');
    });

    it('contributes editor mutationRequirements + session injection on the three mutations', () => {
        expect(postsFeature.authz?.mutationRequirements?.savePost).toBe('editor');
        expect(postsFeature.authz?.mutationRequirements?.deletePost).toBe('editor');
        expect(postsFeature.authz?.mutationRequirements?.setPostPublished).toBe('editor');
        expect(postsFeature.authz?.sessionInjected).toContain('savePost');
        expect(postsFeature.authz?.sessionInjected).toContain('deletePost');
        expect(postsFeature.authz?.sessionInjected).toContain('setPostPublished');
    });

    it('omits resolvers (posts goes through guarded mongo proxy)', () => {
        expect(postsFeature.resolvers).toBeUndefined();
    });
});
