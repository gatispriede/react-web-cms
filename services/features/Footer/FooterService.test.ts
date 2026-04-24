import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {FooterService} from '@services/features/Footer/FooterService';
import {DEFAULT_FOOTER} from '@interfaces/IFooter';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: FooterService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(() => {
    db = client.db(`footer_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    service = new FooterService(db);
});

describe('FooterService', () => {
    it('get returns the default config when nothing is persisted', async () => {
        const cfg = await service.get();
        expect(cfg.enabled).toBe(DEFAULT_FOOTER.enabled);
        expect(Array.isArray(cfg.columns)).toBe(true);
    });

    it('save round-trips through get; bottom + columns preserved', async () => {
        await service.save({
            enabled: true,
            bottom: '© 2026',
            columns: [{title: 'Site', entries: [{label: 'Home', url: '/'}]}],
        }, 'alice@example.com');
        const loaded = await service.get();
        expect(loaded.bottom).toBe('© 2026');
        expect(loaded.columns).toHaveLength(1);
        expect(loaded.columns[0].title).toBe('Site');
        expect(loaded.columns[0].entries[0].label).toBe('Home');
    });

    it('sanitises input — clips long strings, caps columns at 8 and entries at 20', async () => {
        const longTitle = 'x'.repeat(200);
        const longLabel = 'y'.repeat(200);
        await service.save({
            enabled: true,
            bottom: 'z'.repeat(800),
            columns: Array.from({length: 12}, (_, i) => ({
                title: longTitle + i,
                entries: Array.from({length: 30}, (_, j) => ({label: longLabel + j, url: 'https://x'})),
            })),
        });
        const loaded = await service.get();
        expect(loaded.columns.length).toBe(8);
        expect(loaded.columns[0].entries.length).toBe(20);
        expect(loaded.columns[0].title.length).toBeLessThanOrEqual(60);
        expect(loaded.columns[0].entries[0].label.length).toBeLessThanOrEqual(80);
        expect(loaded.bottom!.length).toBeLessThanOrEqual(500);
    });
});
