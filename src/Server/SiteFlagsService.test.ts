import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {SiteFlagsService} from './SiteFlagsService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: SiteFlagsService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(() => {
    db = client.db(`flags_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    service = new SiteFlagsService(db);
});

describe('SiteFlagsService', () => {
    it('get returns defaults (blogEnabled: true) when nothing is persisted', async () => {
        const flags = await service.get();
        expect(flags.blogEnabled).toBe(true);
    });

    it('save persists a flag and get reads it back', async () => {
        await service.save({blogEnabled: false});
        const flags = await service.get();
        expect(flags.blogEnabled).toBe(false);
    });

    it('save merges with existing — unspecified flags keep their current value', async () => {
        await service.save({blogEnabled: false});
        // A second save with an empty patch must not flip `blogEnabled` back to true.
        await service.save({});
        const flags = await service.get();
        expect(flags.blogEnabled).toBe(false);
    });

    it('ignores non-boolean blogEnabled input (defensive against malformed payloads)', async () => {
        await service.save({blogEnabled: 'yes' as any});
        const flags = await service.get();
        // Fell back to the current value (default true).
        expect(flags.blogEnabled).toBe(true);
    });
});
