import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {PublishService} from './PublishService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: PublishService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`publish_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    service = new PublishService(db);
    await db.collection('Navigation').insertMany([{page: 'Home', sections: ['a']}]);
    await db.collection('Sections').insertMany([{id: 'a', type: 1, page: 'Home', content: []}]);
});

describe('PublishService', () => {
    it('publishSnapshot captures navigation+sections and exposes via getActiveSnapshot', async () => {
        const meta = await service.publishSnapshot('alice@example.com', 'first release');
        expect(meta.publishedBy).toBe('alice@example.com');
        expect(meta.note).toBe('first release');
        const snap = await service.getActiveSnapshot();
        expect(snap?.navigation).toEqual([{page: 'Home', sections: ['a']}]);
        expect(snap?.sections).toHaveLength(1);
    });

    it('getHistory returns newest-first and getActiveMeta matches the latest', async () => {
        const a = await service.publishSnapshot(undefined, 'a');
        await new Promise(r => setTimeout(r, 10));
        const b = await service.publishSnapshot(undefined, 'b');
        const history = await service.getHistory();
        expect(history[0].id).toBe(b.id);
        expect(history[1].id).toBe(a.id);
        const active = await service.getActiveMeta();
        expect(active?.id).toBe(b.id);
    });

    it('rollbackTo creates a new snapshot tagged rolledBackFrom and becomes active', async () => {
        const first = await service.publishSnapshot();
        await db.collection('Navigation').deleteMany({});
        await service.publishSnapshot(); // second "latest" that'll get rolled over
        const rolled = await service.rollbackTo(first.id, 'ops');
        expect(rolled.rolledBackFrom).toBe(first.id);
        expect(rolled.publishedBy).toBe('ops');
        const active = await service.getActiveSnapshot();
        expect(active?.navigation).toEqual([{page: 'Home', sections: ['a']}]);
    });

    it('rollbackTo throws for missing id', async () => {
        await expect(service.rollbackTo('nope')).rejects.toThrow(/not found/);
    });
});
