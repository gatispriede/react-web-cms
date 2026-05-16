/**
 * ReleaseScheduler — verifies the in-process timer picks up draft
 * releases whose `scheduledFor` has passed and publishes them via the
 * service. Mongo runs as a standalone mongodb-memory-server (no
 * transactions) so the compensating-saga publish path is exercised.
 */
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, type Db} from 'mongodb';
import {ReleaseService} from './ReleaseService';
import {cancelReleaseScheduler, registerReleaseScheduler} from './ReleaseScheduler';

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
    db = client.db(`releases_sched_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    svc = new ReleaseService(db, client);
    await db.collection('Navigation').insertOne({id: 'page-a', name: 'A', sections: []});
});

afterEach(() => {
    cancelReleaseScheduler();
});

describe('ReleaseScheduler', () => {
    it('listDue returns only past-due draft releases', async () => {
        const past = await svc.create({title: 'past'});
        await svc.attach({releaseId: past.id, entity: 'page', id: 'page-a', draft: {id: 'page-a', name: 'A2'}});
        await svc.update(past.id, {scheduledFor: new Date(Date.now() - 60_000).toISOString()});

        const future = await svc.create({title: 'future'});
        await svc.attach({releaseId: future.id, entity: 'page', id: 'page-a', draft: {id: 'page-a', name: 'A3'}});
        await svc.update(future.id, {scheduledFor: new Date(Date.now() + 60_000).toISOString()});

        const due = await svc.listDue(new Date().toISOString());
        expect(due.map(r => r.id)).toEqual([past.id]);
    });

    it('registerReleaseScheduler publishes a due release on tick', async () => {
        const r = await svc.create({title: 'sched'});
        await svc.attach({releaseId: r.id, entity: 'page', id: 'page-a', draft: {id: 'page-a', name: 'A-scheduled'}});
        await svc.update(r.id, {scheduledFor: new Date(Date.now() - 1_000).toISOString()});

        const res = registerReleaseScheduler(svc, {checkIntervalMs: 30});
        expect(res.registered).toBe(true);

        // Wait long enough for at least one tick + the async publish chain.
        await new Promise(r => setTimeout(r, 200));

        const after = await svc.get(r.id);
        expect(after?.status).toBe('published');
        const live = await db.collection('Navigation').findOne({id: 'page-a'});
        expect(live?.name).toBe('A-scheduled');
    });

    it('disabled via env returns reason without registering', () => {
        const res = registerReleaseScheduler(svc, {env: {RELEASES_SCHEDULER_ENABLED: 'false'} as any});
        expect(res.registered).toBe(false);
        expect(res.reason).toBe('disabled');
    });
});
