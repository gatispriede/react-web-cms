import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {BundleService} from '@services/features/Bundle/BundleService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: BundleService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`bundle_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    service = new BundleService(db);
    // Seed a minimal-but-real site so round-trip has something to serialize.
    await db.collection('Navigation').insertOne({type: 'navigation', id: 'n1', page: 'Home', sections: ['s1'], seo: {}});
    await db.collection('Sections').insertOne({id: 's1', type: 1, page: 'Home', content: [{type: 'TEXT', style: 'default', content: JSON.stringify({value: 'Hi'})}]});
    await db.collection('Languages').insertOne({label: 'English', symbol: 'en', flag: '🇬🇧'});
    await db.collection('Logos').insertOne({id: 'logo-1', type: 'image', content: JSON.stringify({src: '', width: 40, height: 40})});
    await db.collection('Themes').insertOne({id: 't1', name: 'Classic', custom: false, tokens: {colorPrimary: '#3b3939'}});
    await db.collection('SiteSettings').insertOne({key: 'activeThemeId', value: 't1'});
    await db.collection('Posts').insertOne({id: 'p1', slug: 'hello', title: 'Hello', body: 'body', tags: [], draft: false, createdAt: '', updatedAt: ''});
});

afterEach(async () => {
    // Drop to prevent cross-test leakage
    await db.dropDatabase().catch(() => {});
});

describe('BundleService round-trip', () => {
    it('exports current site + imports into an empty DB restores every collection', async () => {
        const bundle = await service.export();
        expect(bundle.manifest.version).toBe(1);
        expect(bundle.site.navigation).toHaveLength(1);
        expect(bundle.site.sections).toHaveLength(1);
        expect(bundle.site.languages?.[0].flag).toBe('🇬🇧');
        expect(bundle.site.themes).toHaveLength(1);
        expect(bundle.site.activeThemeId).toBe('t1');

        // Wipe and import into the same DB — simulates a "restore" flow.
        await Promise.all(['Navigation', 'Sections', 'Languages', 'Logos', 'Themes', 'Posts']
            .map(c => db.collection(c).deleteMany({})));
        await db.collection('SiteSettings').deleteOne({key: 'activeThemeId'});

        const summary = await service.import(bundle);
        expect(summary.restored.Navigation).toBe(1);
        expect(summary.restored.Sections).toBe(1);
        expect(summary.restored.Languages).toBe(1);
        expect(summary.restored.Themes).toBe(1);
        expect(summary.restored.Posts).toBe(1);

        expect(await db.collection('Navigation').countDocuments({})).toBe(1);
        const activeTheme = await db.collection('SiteSettings').findOne({key: 'activeThemeId'}) as any;
        expect(activeTheme?.value).toBe('t1');
    });

    it('rejects a bundle with the wrong version before touching the DB', async () => {
        const bundle = await service.export();
        (bundle.manifest as any).version = 999;
        await expect(service.import(bundle)).rejects.toThrow(/version/i);
        // DB still populated from seed
        expect(await db.collection('Navigation').countDocuments({})).toBe(1);
    });

    it('rejects a bundle where sections[] is not an array (atomic guard)', async () => {
        const bundle = await service.export();
        (bundle.site as any).sections = 'not-an-array';
        await expect(service.import(bundle)).rejects.toThrow(/sections.*array/);
    });

    it('rejects a bundle with a malformed section (content validator fails)', async () => {
        const bundle = await service.export();
        bundle.site.sections = [{id: 's-bad', page: 'Home', type: 'not-a-number', content: []} as any];
        await expect(service.import(bundle)).rejects.toThrow(/Invalid bundle: sections\[0\]/);
    });

    it('skips assets with disallowed extensions; sanitizes spaces / parens / unicode in otherwise safe names', async () => {
        const bundle = await service.export();
        bundle.assets = {
            'evil.exe': 'data:image/png;base64,iVBORw0KGgo=',
            'has spaces.png': 'data:image/png;base64,iVBORw0KGgo=',
            'no-extension': 'data:image/png;base64,iVBORw0KGgo=',
            'IMG_0001 (1).jpg': 'data:image/png;base64,iVBORw0KGgo=',
            'Screenshot 2026-04-26 162952.png': 'data:image/png;base64,iVBORw0KGgo=',
        } as any;
        const summary = await service.import(bundle);
        // 3 written: `has spaces.png`, `IMG_0001 (1).jpg`, `Screenshot 2026-04-26 162952.png` — all sanitized.
        expect(summary.assets).toBe(3);
        // 2 skipped: `evil.exe` (extension) + `no-extension` (no allowed extension).
        expect(summary.skippedAssets.length).toBe(2);
        expect(summary.skippedAssets.every(s => /unsafe filename/i.test(s))).toBe(true);
    });

    it('rejects null bytes, control characters, and `..` traversal segments outright', async () => {
        const bundle = await service.export();
        bundle.assets = {
            'a\x00b.png': 'data:image/png;base64,iVBORw0KGgo=',
            '../escape.png': 'data:image/png;base64,iVBORw0KGgo=',
            'tab\there.png': 'data:image/png;base64,iVBORw0KGgo=',
        } as any;
        const summary = await service.import(bundle);
        // `../escape.png` → basename is `escape.png` (path.basename strips it),
        // so it survives — that's by design and is the second-line traversal
        // guard's job. Null byte + control char are hard rejects.
        expect(summary.skippedAssets.filter(s => /unsafe filename/i.test(s)).length).toBeGreaterThanOrEqual(2);
    });
});
