import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {SiteSeoService} from './SiteSeoService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: SiteSeoService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(() => {
    db = client.db(`seo_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    service = new SiteSeoService(db);
});

describe('SiteSeoService', () => {
    it('get returns empty defaults when no doc exists', async () => {
        const seo = await service.get();
        expect(seo).toEqual({});
    });

    it('save persists fields and get reads them back', async () => {
        await service.save({
            siteName: 'Acme',
            primaryDomain: 'https://acme.test',
            defaultDescription: 'Best widgets',
        });
        const loaded = await service.get();
        expect(loaded.siteName).toBe('Acme');
        expect(loaded.primaryDomain).toBe('https://acme.test');
        expect(loaded.defaultDescription).toBe('Best widgets');
    });

    it('save clips overly long strings to their max length', async () => {
        const long = 'x'.repeat(600);
        await service.save({defaultDescription: long} as any);
        const loaded = await service.get();
        expect(loaded.defaultDescription?.length).toBe(500);
    });

    it('save sanitizes non-string values to undefined', async () => {
        await service.save({siteName: 123 as any, defaultLocale: 'en_US'});
        const loaded = await service.get();
        expect(loaded.siteName ?? undefined).toBeUndefined();
        expect(loaded.defaultLocale).toBe('en_US');
    });
});
