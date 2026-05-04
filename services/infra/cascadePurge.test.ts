import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {InMemoryRedis} from '@services/infra/redis';
import type {FeatureContext} from '@services/infra/featureManifest';
import {cascadePurge} from '@services/infra/cascadePurge';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let ctx: FeatureContext;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`purge_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    ctx = {db, redis: new InMemoryRedis() as any, services: {}, reconnect: async () => {}};
});

describe('cascadePurge', () => {
    it('hard-deletes every row tagged with the given trashGroup across all *.trash collections', async () => {
        await db.collection('Navigation.trash').insertMany([
            {id: 'p1', trashGroup: 'TG1', deletedAt: new Date()},
            {id: 'p2', trashGroup: 'TG2', deletedAt: new Date()},
        ] as any);
        await db.collection('Sections.trash').insertMany([
            {id: 's1', trashGroup: 'TG1'},
            {id: 's2', trashGroup: 'TG1'},
        ] as any);

        const res = await cascadePurge('TG1', ctx);

        expect(res.counts['Navigation.trash']).toBe(1);
        expect(res.counts['Sections.trash']).toBe(2);
        // TG2 is untouched.
        expect(await db.collection('Navigation.trash').countDocuments({trashGroup: 'TG2'})).toBe(1);
        // TG1 fully purged.
        expect(await db.collection('Navigation.trash').countDocuments({trashGroup: 'TG1'})).toBe(0);
        expect(await db.collection('Sections.trash').countDocuments({trashGroup: 'TG1'})).toBe(0);
    });

    it('is idempotent — second call returns zero counts', async () => {
        await db.collection('Navigation.trash').insertOne({id: 'p1', trashGroup: 'TG1'} as any);
        await cascadePurge('TG1', ctx);
        const second = await cascadePurge('TG1', ctx);
        expect(Object.values(second.counts).reduce((a, b) => a + b, 0)).toBe(0);
    });

    it('throws when trashGroup is empty', async () => {
        await expect(cascadePurge('', ctx)).rejects.toThrow();
    });
});
