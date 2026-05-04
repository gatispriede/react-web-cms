import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {runI18nGrantMigration} from './i18nGrantMigration';

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
    db = client.db(`i18n_migration_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('runI18nGrantMigration', () => {
    it('no-ops when the inlineTranslationEdit flag is absent', async () => {
        const granted = await runI18nGrantMigration(db);
        expect(granted).toBe(0);
    });

    it('no-ops when the inlineTranslationEdit flag is false', async () => {
        await db.collection('SiteSettings').insertOne({
            key: 'siteFlags',
            value: {inlineTranslationEdit: false},
        });
        await db.collection('User').insertOne({email: 'e@x', role: 'editor'});
        const granted = await runI18nGrantMigration(db);
        expect(granted).toBe(0);
        const u = await db.collection('User').findOne({email: 'e@x'});
        expect(u?.functionalRoles).toBeUndefined();
    });

    it('grants translator to every editor and drops the flag when ON', async () => {
        await db.collection('SiteSettings').insertOne({
            key: 'siteFlags',
            value: {inlineTranslationEdit: true, blogEnabled: true},
        });
        await db.collection('User').insertMany([
            {email: 'a@x', role: 'editor'},
            {email: 'b@x', role: 'editor', functionalRoles: ['something-else']},
            {email: 'c@x', role: 'admin'}, // not an editor → skipped
            {email: 'd@x', role: 'viewer'}, // not an editor → skipped
        ]);

        const granted = await runI18nGrantMigration(db);
        expect(granted).toBe(2);

        const a = await db.collection('User').findOne({email: 'a@x'});
        expect(a?.functionalRoles).toEqual(['translator']);

        const b = await db.collection('User').findOne({email: 'b@x'});
        expect(b?.functionalRoles).toEqual(['something-else', 'translator']);

        const c = await db.collection('User').findOne({email: 'c@x'});
        expect(c?.functionalRoles).toBeUndefined();

        const d = await db.collection('User').findOne({email: 'd@x'});
        expect(d?.functionalRoles).toBeUndefined();

        const flags = await db.collection('SiteSettings').findOne({key: 'siteFlags'});
        expect((flags as any)?.value?.inlineTranslationEdit).toBe(false);
        expect((flags as any)?.value?.blogEnabled).toBe(true); // untouched
    });

    it('is idempotent — second run is a no-op (flag already off)', async () => {
        await db.collection('SiteSettings').insertOne({
            key: 'siteFlags',
            value: {inlineTranslationEdit: true},
        });
        await db.collection('User').insertOne({email: 'a@x', role: 'editor'});

        const first = await runI18nGrantMigration(db);
        expect(first).toBe(1);

        const second = await runI18nGrantMigration(db);
        expect(second).toBe(0);

        const a = await db.collection('User').findOne({email: 'a@x'});
        expect(a?.functionalRoles).toEqual(['translator']);
    });

    it('skips editors that already hold the translator role', async () => {
        await db.collection('SiteSettings').insertOne({
            key: 'siteFlags',
            value: {inlineTranslationEdit: true},
        });
        await db.collection('User').insertMany([
            {email: 'a@x', role: 'editor', functionalRoles: ['translator']},
            {email: 'b@x', role: 'editor'},
        ]);

        const granted = await runI18nGrantMigration(db);
        expect(granted).toBe(1);

        const a = await db.collection('User').findOne({email: 'a@x'});
        expect(a?.functionalRoles).toEqual(['translator']);
    });
});
