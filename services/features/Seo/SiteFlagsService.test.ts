import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {SiteFlagsService, resolveLayoutMode} from '@services/features/Seo/SiteFlagsService';

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

    // F6 site-mode-toggle — layoutMode enum + 'auto' resolution.

    it('accepts layoutMode="scroll" and persists it', async () => {
        await service.save({layoutMode: 'scroll'});
        const flags = await service.get();
        expect(flags.layoutMode).toBe('scroll');
    });

    it('accepts layoutMode="auto" and persists it', async () => {
        await service.save({layoutMode: 'auto'});
        const flags = await service.get();
        expect(flags.layoutMode).toBe('auto');
    });

    it('rejects invalid layoutMode and keeps current', async () => {
        await service.save({layoutMode: 'multipage' as any});
        const flags = await service.get();
        // Fell back to the default 'tabs'.
        expect(flags.layoutMode).toBe('tabs');
    });
});

describe('resolveLayoutMode', () => {
    it('passes scroll through', () => {
        expect(resolveLayoutMode('scroll')).toBe('scroll');
    });
    it('passes tabs through', () => {
        expect(resolveLayoutMode('tabs')).toBe('tabs');
    });
    it('resolves auto to tabs (safe default)', () => {
        expect(resolveLayoutMode('auto')).toBe('tabs');
    });
    it('resolves undefined / null / unknown to tabs', () => {
        expect(resolveLayoutMode(undefined)).toBe('tabs');
        expect(resolveLayoutMode(null)).toBe('tabs');
        expect(resolveLayoutMode('multipage' as any)).toBe('tabs');
    });
});
