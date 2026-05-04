import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {OnboardingService} from '../OnboardingService';

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

beforeEach(async () => {
    db = client.db(`onboarding_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
});

describe('OnboardingService', () => {
    it('isFreshInstall is true on an empty Users collection', async () => {
        const svc = new OnboardingService(db, 4);
        await expect(svc.isFreshInstall()).resolves.toBe(true);
    });

    it('isFreshInstall is false once an admin exists', async () => {
        const svc = new OnboardingService(db, 4);
        await db.collection('Users').insertOne({id: 'u1', email: 'a@b.c', role: 'admin', kind: 'admin'});
        await expect(svc.isFreshInstall()).resolves.toBe(false);
    });

    it('legacy admin-role docs without kind still count as occupying', async () => {
        // Legacy back-compat — older installs may have role:'admin'
        // without a kind field. They shouldn't expose the wizard.
        const svc = new OnboardingService(db, 4);
        await db.collection('Users').insertOne({id: 'legacy', email: 'l@e.g', role: 'admin'});
        await expect(svc.isFreshInstall()).resolves.toBe(false);
    });

    it('bootstrap creates an admin, writes site flags, and refuses a second run', async () => {
        const svc = new OnboardingService(db, 4);
        const result = await svc.bootstrap({
            siteName: 'Acme',
            locale: 'en',
            adminEmail: 'admin@acme.test',
            adminPassword: 'super-secret-1234',
            themeKey: undefined,
        });
        expect(result.userId).toBeTruthy();
        expect(result.email).toBe('admin@acme.test');

        const user = await db.collection('Users').findOne({email: 'admin@acme.test'});
        expect(user).toBeTruthy();
        expect((user as any).role).toBe('admin');
        expect((user as any).kind).toBe('admin');
        expect((user as any).password).not.toBe('super-secret-1234'); // hashed

        const flags = await db.collection('SiteSettings').findOne({key: 'siteFlags'});
        expect((flags as any).value.siteName).toBe('Acme');
        expect((flags as any).value.defaultLocale).toBe('en');

        const lang = await db.collection('Languages').findOne({symbol: 'en'});
        expect((lang as any).default).toBe(true);

        // Race guard — second call must throw.
        await expect(svc.bootstrap({
            siteName: 'Other',
            locale: 'lv',
            adminEmail: 'other@acme.test',
            adminPassword: 'another-secret-1234',
        })).rejects.toThrow(/already complete/);
    });

    it('bootstrap rejects weak passwords', async () => {
        const svc = new OnboardingService(db, 4);
        await expect(svc.bootstrap({
            siteName: 'A', locale: 'en',
            adminEmail: 'a@b.cd', adminPassword: 'short',
        })).rejects.toThrow(/at least 12/);
    });

    it('bootstrap rejects malformed email', async () => {
        const svc = new OnboardingService(db, 4);
        await expect(svc.bootstrap({
            siteName: 'A', locale: 'en',
            adminEmail: 'not-an-email', adminPassword: 'long-enough-password',
        })).rejects.toThrow(/adminEmail/);
    });

    it('bootstrap activates a theme by name when present', async () => {
        await db.collection('Themes').insertOne({id: 'theme-1', name: 'Studio', custom: false, tokens: {}});
        const svc = new OnboardingService(db, 4);
        const result = await svc.bootstrap({
            siteName: 'A', locale: 'en',
            adminEmail: 'a@b.cd', adminPassword: 'long-enough-password',
            themeKey: 'Studio',
        });
        expect(result.themeId).toBe('theme-1');
        const active = await db.collection('SiteSettings').findOne({key: 'activeThemeId'});
        expect((active as any).value).toBe('theme-1');
    });
});
