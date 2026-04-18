import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {NavigationService} from './NavigationService';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let navigation: Collection;
let sections: Collection;
let service: NavigationService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`nav_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    navigation = db.collection('Navigation');
    sections = db.collection('Sections');
    service = new NavigationService(navigation, sections, async () => {});
});

describe('NavigationService.updateNavigation', () => {
    it('rewrites sections[] on an existing nav doc', async () => {
        await navigation.insertOne({type: 'navigation', id: 'n1', page: 'Home', sections: ['a', 'b'], seo: {}});
        await service.updateNavigation('Home', ['b', 'a']);
        const doc = await navigation.findOne({page: 'Home'}) as any;
        expect(doc.sections).toEqual(['b', 'a']);
        expect(doc.type).toBe('navigation');
        expect(doc.id).toBe('n1');
    });

    it('upsert creates a well-formed nav doc (not a bare {page, sections})', async () => {
        await service.updateNavigation('Brand New', ['x']);
        const doc = await navigation.findOne({page: 'Brand New'}) as any;
        expect(doc).toBeTruthy();
        expect(doc.type).toBe('navigation');
        expect(typeof doc.id).toBe('string');
        expect(doc.id.length).toBeGreaterThan(0);
        expect(doc.seo).toEqual({});
        expect(doc.sections).toEqual(['x']);
    });

    it('does not clobber non-navigation docs that happen to share the page key', async () => {
        await navigation.insertOne({type: 'snapshot', page: 'Home', payload: 'unrelated'} as any);
        await service.updateNavigation('Home', ['only-in-nav']);
        const snap = await navigation.findOne({type: 'snapshot', page: 'Home'}) as any;
        expect(snap.payload).toBe('unrelated');
        const nav = await navigation.findOne({type: 'navigation', page: 'Home'}) as any;
        expect(nav.sections).toEqual(['only-in-nav']);
    });
});

describe('NavigationService audit stamps', () => {
    it('updateNavigation stamps editedAt + editedBy on the nav doc', async () => {
        await navigation.insertOne({type: 'navigation', id: 'n1', page: 'Home', sections: ['a'], seo: {}});
        const before = Date.now();
        await service.updateNavigation('Home', ['a', 'b'], 'alice@example.com');
        const doc = await navigation.findOne({page: 'Home'}) as any;
        expect(doc.editedBy).toBe('alice@example.com');
        expect(new Date(doc.editedAt).getTime()).toBeGreaterThanOrEqual(before);
    });

    it('addUpdateSectionItem (insert + update) stamps audit on the Section', async () => {
        // insert path
        const raw = await service.addUpdateSectionItem({
            section: {type: 1, page: 'Home', content: []} as any,
            pageName: 'Home',
            editedBy: 'bob@example.com',
        });
        const newId = JSON.parse(raw).createSection?.id;
        expect(newId).toBeTruthy();
        const inserted = await sections.findOne({id: newId}) as any;
        expect(inserted.editedBy).toBe('bob@example.com');
        expect(inserted.editedAt).toBeTruthy();

        // update path — different editor, audit should refresh
        await new Promise(r => setTimeout(r, 5));
        await service.addUpdateSectionItem({
            section: {id: newId, type: 1, page: 'Home', content: []} as any,
            editedBy: 'carol@example.com',
        });
        const updated = await sections.findOne({id: newId}) as any;
        expect(updated.editedBy).toBe('carol@example.com');
        expect(new Date(updated.editedAt).getTime()).toBeGreaterThanOrEqual(new Date(inserted.editedAt).getTime());
    });

    it('omits editedBy when the caller did not supply one (standalone / anonymous path)', async () => {
        await navigation.insertOne({type: 'navigation', id: 'n2', page: 'Anon', sections: [], seo: {}});
        await service.updateNavigation('Anon', ['x']);
        const doc = await navigation.findOne({page: 'Anon'}) as any;
        expect(doc.editedBy).toBeUndefined();
        expect(doc.editedAt).toBeTruthy();
    });
});

describe('NavigationService.getNavigationCollection', () => {
    it('filters out legacy ghost docs without type: "navigation"', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'n1', page: 'Real', sections: ['a'], seo: {}},
            // Ghost row that the pre-fix `updateNavigation` could create —
            // admin must not render this as a page.
            {page: 'Ghost', sections: ['b']} as any,
        ]);
        const list = await service.getNavigationCollection();
        expect(list).toHaveLength(1);
        expect(list[0].page).toBe('Real');
    });
});

describe('NavigationService.deleteNavigationItem', () => {
    it('cascades — deletes the page\'s sections before removing the nav doc', async () => {
        await navigation.insertOne({type: 'navigation', id: 'n1', page: 'Goodbye', sections: ['s1', 's2'], seo: {}});
        await sections.insertMany([
            {id: 's1', type: 1, page: 'Goodbye', content: []},
            {id: 's2', type: 1, page: 'Goodbye', content: []},
            {id: 's3', type: 1, page: 'Other', content: []},
        ]);

        const raw = await service.deleteNavigationItem('Goodbye');
        const result = JSON.parse(raw);
        expect(result.navigationDeleted).toBe(1);
        expect(result.sectionsDeleted).toBe(2);

        expect(await navigation.findOne({page: 'Goodbye'})).toBeNull();
        expect(await sections.countDocuments({id: {$in: ['s1', 's2']}})).toBe(0);
        // Sections owned by other pages stay.
        expect(await sections.findOne({id: 's3'})).not.toBeNull();
    });

    it('is a no-op when the page does not exist', async () => {
        const result = await service.deleteNavigationItem('Nope');
        expect(result).toMatch(/no navigation/i);
    });
});
