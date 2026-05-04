import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {InMemoryRedis} from '@services/infra/redis';
import type {FeatureContext} from '@services/infra/featureManifest';
import {cascadeDelete, _resetCascadeIndexCacheForTests} from '@services/infra/cascadeDelete';
import {cascadeRestore} from '@services/infra/cascadeRestore';

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
    _resetCascadeIndexCacheForTests();
    db = client.db(`cascade_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    // The cascade engine reaches `(db as any).client` for transactions.
    (db as any).client = client;
    ctx = {
        db,
        redis: new InMemoryRedis() as any,
        services: {},
        reconnect: async () => {},
    };
    // Seed a Navigation row pointing at three Sections — mirrors the
    // canonical "delete page cascades to its Sections" case.
    await db.collection('Navigation').insertOne({
        id: 'nav-home', type: 'navigation', page: 'Home', sections: ['s1', 's2', 's3'], seo: {},
    });
    await db.collection('Sections').insertMany([
        {id: 's1', type: 1, page: 'Home', content: []},
        {id: 's2', type: 1, page: 'Home', content: []},
        {id: 's3', type: 1, page: 'Home', content: []},
    ]);
});

afterEach(async () => {
    await db.dropDatabase().catch(() => {});
});

describe('cascadeDelete', () => {
    it('moves the parent + all matched children into *.trash with a shared trashGroup', async () => {
        const result = await cascadeDelete('navigation', 'Navigation', 'nav-home', ctx);

        expect(result.trashGroup).toBeTruthy();
        expect(result.counts.Navigation).toBe(1);
        expect(result.counts.Sections).toBe(3);

        // Origin collections empty for those rows.
        expect(await db.collection('Navigation').countDocuments({id: 'nav-home'})).toBe(0);
        expect(await db.collection('Sections').countDocuments({id: {$in: ['s1', 's2', 's3']}})).toBe(0);

        // Trash collections have the rows with deletedAt + trashGroup.
        const trashedNav = await db.collection('Navigation.trash').find({trashGroup: result.trashGroup}).toArray();
        const trashedSec = await db.collection('Sections.trash').find({trashGroup: result.trashGroup}).toArray();
        expect(trashedNav).toHaveLength(1);
        expect(trashedSec).toHaveLength(3);
        for (const row of [...trashedNav, ...trashedSec]) {
            expect(row.deletedAt).toBeInstanceOf(Date);
            expect(row.trashGroup).toBe(result.trashGroup);
        }
    });

    it('ensures a TTL index on each *.trash collection', async () => {
        const result = await cascadeDelete('navigation', 'Navigation', 'nav-home', ctx);
        for (const coll of ['Navigation.trash', 'Sections.trash']) {
            const idxs = await db.collection(coll).indexes();
            const ttl = idxs.find(i => (i.expireAfterSeconds ?? -1) >= 0 && i.key?.deletedAt === 1);
            expect(ttl).toBeTruthy();
            expect(ttl?.expireAfterSeconds).toBe(86_400);
        }
        expect(result.trashGroup).toBeTruthy();
    });

    it('cascade rule with no matching children does not crash', async () => {
        // Insert a Navigation with no sections array.
        await db.collection('Navigation').insertOne({id: 'empty-nav', type: 'navigation', page: 'Empty', sections: [], seo: {}});
        const result = await cascadeDelete('navigation', 'Navigation', 'empty-nav', ctx);
        expect(result.counts.Navigation).toBe(1);
        // `Sections` key may exist with 0, or not at all — both are fine.
        expect(result.counts.Sections ?? 0).toBe(0);
    });

    it('returns counts with parent=0 when the parent id is unknown', async () => {
        const result = await cascadeDelete('navigation', 'Navigation', 'does-not-exist', ctx);
        expect(result.counts.Navigation).toBe(0);
    });

    it('Permissions cascade rule moves page-scoped grants to trash when their page is deleted', async () => {
        // Seed two page-scoped grants on /Home + one unrelated grant.
        await db.collection('Permissions').insertMany([
            {userId: 'u1', scope: 'page', resourceId: 'Home'},
            {userId: 'u2', scope: 'page', resourceId: 'Home'},
            {userId: 'u3', scope: 'page', resourceId: 'About'},
            {userId: 'u4', scope: 'module', resourceId: 'Home'},
        ]);

        const result = await cascadeDelete('navigation', 'Navigation', 'nav-home', ctx);

        // Both Home page-scoped grants moved into trash; About + module grants survive.
        expect(result.counts.Permissions).toBe(2);
        expect(await db.collection('Permissions').countDocuments({})).toBe(2);
        const trashed = await db.collection('Permissions.trash').find({trashGroup: result.trashGroup}).toArray();
        expect(trashed).toHaveLength(2);
        expect(trashed.every((r: any) => r.scope === 'page' && r.resourceId === 'Home')).toBe(true);
    });
});

describe('cascadeDelete recursive Navigation→Navigation', () => {
    it('3-level page tree: deleting the root cascades all descendants into trash with one trashGroup', async () => {
        // Root → child → grandchild. The seeded `nav-home` row is unrelated.
        await db.collection('Navigation').insertMany([
            {id: 'root', type: 'navigation', page: 'Root', sections: [], seo: {}},
            {id: 'child', type: 'navigation', page: 'Child', parent: 'root', sections: [], seo: {}},
            {id: 'grand', type: 'navigation', page: 'Grand', parent: 'child', sections: [], seo: {}},
        ]);

        const result = await cascadeDelete('navigation', 'Navigation', 'root', ctx);

        // Root + 2 levels of descendants = 3 Navigation rows in trash.
        expect(result.counts.Navigation).toBe(3);
        const trashed = await db.collection('Navigation.trash')
            .find({trashGroup: result.trashGroup}).toArray();
        const ids = new Set(trashed.map((d: any) => d.id));
        expect(ids.has('root')).toBe(true);
        expect(ids.has('child')).toBe(true);
        expect(ids.has('grand')).toBe(true);
        // Origin collection: only the unrelated `nav-home` survives.
        const survivors = await db.collection('Navigation').find({}).toArray();
        expect(survivors.map((d: any) => d.id).sort()).toEqual(['nav-home']);
    });

    it('cascadeRestore brings every level of the recursive tree back', async () => {
        await db.collection('Navigation').insertMany([
            {id: 'r2', type: 'navigation', page: 'R2', sections: [], seo: {}},
            {id: 'c2', type: 'navigation', page: 'C2', parent: 'r2', sections: [], seo: {}},
            {id: 'g2', type: 'navigation', page: 'G2', parent: 'c2', sections: [], seo: {}},
        ]);
        const {trashGroup} = await cascadeDelete('navigation', 'Navigation', 'r2', ctx);

        const restored = await cascadeRestore(trashGroup, ctx);
        expect(restored.counts.Navigation).toBe(3);

        const ids = (await db.collection('Navigation').find({}).toArray()).map((d: any) => d.id).sort();
        expect(ids).toEqual(['c2', 'g2', 'nav-home', 'r2']);
        expect(await db.collection('Navigation.trash').countDocuments({trashGroup})).toBe(0);
    });
});

describe('cascadeDelete doc-mutate rule (SiteSeo)', () => {
    beforeEach(async () => {
        // Seed an `about` Navigation page + a SiteSettings(siteSeo)
        // singleton with two per-page SEO entries.
        await db.collection('Navigation').insertOne({
            id: 'nav-about', type: 'navigation', page: 'about', slug: 'about', sections: [], seo: {},
        });
        await db.collection('SiteSettings').insertOne({
            key: 'siteSeo',
            value: {siteName: 'X'},
            pages: {
                about: {title: 'About'},
                contact: {title: 'Contact'},
            },
            version: 1,
        });
    });

    it('drops pages.<slug> from the SiteSeo singleton when the Navigation row is deleted', async () => {
        const result = await cascadeDelete('navigation', 'Navigation', 'nav-about', ctx);

        expect(result.counts.Navigation).toBe(1);
        // doc-mutate counts the modifiedCount on the target collection.
        expect(result.counts.SiteSettings).toBe(1);

        const seo = await db.collection('SiteSettings').findOne({key: 'siteSeo'}) as any;
        expect(seo).toBeTruthy();
        expect(seo.pages).toEqual({contact: {title: 'Contact'}});

        // Navigation row in trash.
        const trashedNav = await db.collection('Navigation.trash').find({trashGroup: result.trashGroup}).toArray();
        expect(trashedNav).toHaveLength(1);
        expect(trashedNav[0].id).toBe('nav-about');
    });

    it('restore brings the Navigation page back but does NOT re-instate SiteSeo.pages.<slug>', async () => {
        const {trashGroup} = await cascadeDelete('navigation', 'Navigation', 'nav-about', ctx);

        const restored = await cascadeRestore(trashGroup, ctx);
        expect(restored.counts.Navigation).toBe(1);

        // Navigation rehydrated.
        expect(await db.collection('Navigation').countDocuments({id: 'nav-about'})).toBe(1);

        // SiteSeo.pages.about stays GONE — singleton mutations are one-way.
        const seo = await db.collection('SiteSettings').findOne({key: 'siteSeo'}) as any;
        expect(seo.pages).toEqual({contact: {title: 'Contact'}});
    });
});

describe('cascadeDelete Posts pin (F2)', () => {
    it('cascades posts pinned to a deleted page; leaves unpinned posts and other-page-pinned posts alone', async () => {
        // Seed: one pinned post (pageId === nav-home), one pinned to a
        // different page, one unpinned (pageId absent).
        await db.collection('Posts').insertMany([
            {id: 'p-pinned', slug: 'pinned', title: 'Pinned to Home', body: '', pageId: 'nav-home', draft: false},
            {id: 'p-other',  slug: 'other',  title: 'Pinned elsewhere', body: '', pageId: 'nav-other', draft: false},
            {id: 'p-free',   slug: 'free',   title: 'Unpinned',         body: '',                       draft: false},
        ]);

        const result = await cascadeDelete('navigation', 'Navigation', 'nav-home', ctx);

        // Only the post pinned to nav-home cascades.
        expect(result.counts.Posts).toBe(1);
        const survivors = await db.collection('Posts').find({}).project({id: 1, _id: 0}).toArray();
        expect(survivors.map((d: any) => d.id).sort()).toEqual(['p-free', 'p-other']);

        const trashed = await db.collection('Posts.trash').find({trashGroup: result.trashGroup}).toArray();
        expect(trashed).toHaveLength(1);
        expect((trashed[0] as any).id).toBe('p-pinned');
    });

    it('cascadeRestore brings a pinned post back alongside its page', async () => {
        await db.collection('Posts').insertOne({
            id: 'p-pinned-restore', slug: 'pr', title: 'Pinned', body: '', pageId: 'nav-home', draft: false,
        });
        const {trashGroup} = await cascadeDelete('navigation', 'Navigation', 'nav-home', ctx);

        const restored = await cascadeRestore(trashGroup, ctx);
        expect(restored.counts.Posts).toBe(1);
        const back = await db.collection('Posts').findOne({id: 'p-pinned-restore'}) as any;
        expect(back).toBeTruthy();
        expect(back.pageId).toBe('nav-home');
        expect(back.deletedAt).toBeUndefined();
        expect(back.trashGroup).toBeUndefined();
    });
});

describe('cascadeRestore', () => {
    it('restores every doc in a trashGroup back to its origin collection', async () => {
        const {trashGroup} = await cascadeDelete('navigation', 'Navigation', 'nav-home', ctx);

        const result = await cascadeRestore(trashGroup, ctx);
        expect(result.counts.Navigation).toBe(1);
        expect(result.counts.Sections).toBe(3);

        // Origin collections rehydrated.
        expect(await db.collection('Navigation').countDocuments({id: 'nav-home'})).toBe(1);
        expect(await db.collection('Sections').countDocuments({id: {$in: ['s1', 's2', 's3']}})).toBe(3);

        // Trash empty for that group.
        expect(await db.collection('Navigation.trash').countDocuments({trashGroup})).toBe(0);
        expect(await db.collection('Sections.trash').countDocuments({trashGroup})).toBe(0);

        // Restored rows have NO deletedAt / trashGroup left over.
        const restored = await db.collection('Navigation').findOne({id: 'nav-home'}) as any;
        expect(restored.deletedAt).toBeUndefined();
        expect(restored.trashGroup).toBeUndefined();
    });
});
