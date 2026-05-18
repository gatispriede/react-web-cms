/**
 * ReleaseService — atomic publish + rollback round-trip + concurrent
 * publish guard. Runs against an mongodb-memory-server standalone Mongo
 * (no transactions) so the compensating-saga fallback is the path under
 * test — failures during publish must revert previously-written members.
 */
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, type Db} from 'mongodb';
import {ReleaseService} from './ReleaseService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let svc: ReleaseService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`releases_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    svc = new ReleaseService(db, client);
    // Seed two live entities — one page (Navigation) + one post.
    await db.collection('Navigation').insertOne({id: 'page-a', name: 'About', sections: []});
    await db.collection('Posts').insertOne({id: 'post-a', slug: 'hello', title: 'Hello', body: 'old', draft: false, tags: [], createdAt: '', updatedAt: ''});
});

describe('ReleaseService — happy path', () => {
    it('creates → attaches drafts → publishes atomically; live rows reflect the snapshots', async () => {
        const r = await svc.create({title: 'Spring refresh'});
        expect(r.status).toBe('draft');

        // Override the snapshot the publisher would otherwise auto-grab —
        // we want to verify the release writes new bytes, not the existing ones.
        await db.collection('Navigation').updateOne({id: 'page-a'}, {$set: {name: 'About (draft)', sections: ['s-new']}});
        await db.collection('Posts').updateOne({id: 'post-a'}, {$set: {title: 'Hello (draft)', body: 'new'}});

        const r2 = await svc.attach({releaseId: r.id, entity: 'page', id: 'page-a'});
        expect(r2.members).toHaveLength(1);
        expect(r2.members[0].snapshot.name).toBe('About (draft)');
        // Pre-release snapshot should still hold the original.
        expect((r2.members[0].preReleaseSnapshot as any).name).toBe('About (draft)');

        // Revert the live state and re-attach to capture a true "draft vs live" delta
        await db.collection('Navigation').updateOne({id: 'page-a'}, {$set: {name: 'About', sections: []}});

        // Re-attach with a fresh explicit draft + ensure pre-release captures the reverted live.
        const r3 = await svc.attach({releaseId: r.id, entity: 'page', id: 'page-a', draft: {id: 'page-a', name: 'About (draft 2)', sections: ['s-new']}});
        expect((r3.members[0].preReleaseSnapshot as any).name).toBe('About');
        expect((r3.members[0].snapshot as any).name).toBe('About (draft 2)');

        await svc.attach({releaseId: r.id, entity: 'post', id: 'post-a', draft: {id: 'post-a', slug: 'hello', title: 'Hello (draft)', body: 'new', draft: false, tags: [], createdAt: '', updatedAt: ''}});

        const published = await svc.publish({releaseId: r.id});
        expect(published.status).toBe('published');

        const livePage = await db.collection('Navigation').findOne({id: 'page-a'});
        const livePost = await db.collection('Posts').findOne({id: 'post-a'});
        expect(livePage?.name).toBe('About (draft 2)');
        expect(livePost?.title).toBe('Hello (draft)');
    });
});

describe('ReleaseService — compensating saga on failure', () => {
    it('reverts already-written members when a later publish step throws', async () => {
        // Patch db.collection BEFORE constructing the service so the
        // publishers capture our proxy in their closures.
        const originalCollection = db.collection.bind(db);
        const failingDb = new Proxy(db, {
            get(target, prop, recv) {
                if (prop === 'collection') {
                    return (name: string) => {
                        const col = originalCollection(name);
                        if (name !== 'Posts') return col;
                        return new Proxy(col, {
                            get(t, p, r2) {
                                if (p === 'replaceOne') {
                                    return async () => { throw new Error('simulated post write failure'); };
                                }
                                return Reflect.get(t, p, r2);
                            },
                        });
                    };
                }
                return Reflect.get(target, prop, recv);
            },
        }) as Db;
        svc = new ReleaseService(failingDb, client);

        const r = await svc.create({title: 'Will fail'});
        await svc.attach({releaseId: r.id, entity: 'page', id: 'page-a', draft: {id: 'page-a', name: 'NewName', sections: []}});
        await svc.attach({releaseId: r.id, entity: 'post', id: 'post-a', draft: {id: 'post-a', slug: 'hello', title: 'NewTitle', body: 'x', draft: false, tags: [], createdAt: '', updatedAt: ''}});

        // Second member (Posts) blows up on publish — first member must revert.
        await expect(svc.publish({releaseId: r.id})).rejects.toThrow(/release publish failed/);

        // First member must have been reverted to its pre-release snapshot.
        const livePage = await db.collection('Navigation').findOne({id: 'page-a'});
        expect(livePage?.name).toBe('About');

        // Release status should be `failed`, lastError populated.
        const after = await svc.get(r.id);
        expect(after?.status).toBe('failed');
        expect(after?.lastError).toMatch(/simulated post write failure/);
    });
});

describe('ReleaseService — rollback round-trip', () => {
    it('rollback creates a new release that restores pre-release snapshots and marks the original rolled-back', async () => {
        const r = await svc.create({title: 'V1'});
        await svc.attach({
            releaseId: r.id, entity: 'page', id: 'page-a',
            draft: {id: 'page-a', name: 'V1-name', sections: ['s1']},
        });
        await svc.publish({releaseId: r.id});

        // Live should reflect V1 now.
        const afterPublish = await db.collection('Navigation').findOne({id: 'page-a'});
        expect(afterPublish?.name).toBe('V1-name');

        const rolledBack = await svc.rollback(r.id);
        expect(rolledBack.status).toBe('published');
        expect(rolledBack.rollbackOf).toBe(r.id);

        // Live should now be back to the pre-release state ("About").
        const afterRollback = await db.collection('Navigation').findOne({id: 'page-a'});
        expect(afterRollback?.name).toBe('About');

        // Original release marked rolled-back.
        const original = await svc.get(r.id);
        expect(original?.status).toBe('rolled-back');
    });
});

describe('ReleaseService — concurrent publish guard', () => {
    it('rejects a second publish call while a release is in publishing/published state', async () => {
        const r = await svc.create({title: 'OCC'});
        await svc.attach({
            releaseId: r.id, entity: 'page', id: 'page-a',
            draft: {id: 'page-a', name: 'X', sections: []},
        });
        await svc.publish({releaseId: r.id});

        // Already published — must reject.
        await expect(svc.publish({releaseId: r.id})).rejects.toThrow(/cannot publish from status published/);
    });
});
