import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db, Collection} from 'mongodb';
import {NavigationService} from '@services/features/Navigation/NavigationService';

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

describe('NavigationService.setParent (F1 sub-pages)', () => {
    it('promotes a root page to a child of an existing parent (happy path)', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'p-root', page: 'Services', sections: [], seo: {}},
            {type: 'navigation', id: 'p-child', page: 'Cleaning', sections: [], seo: {}},
        ]);
        const raw = await service.setParent('p-child', 'p-root', 'alice@example.com');
        const parsed = JSON.parse(raw);
        expect(parsed.setParent?.parent).toBe('p-root');
        const doc = await navigation.findOne({id: 'p-child'}) as any;
        expect(doc.parent).toBe('p-root');
        expect(doc.editedBy).toBe('alice@example.com');
        expect(typeof doc.version).toBe('number');
    });

    it('clearing parent (parentId=null) removes the parent field and makes it root', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'p-root', page: 'A', sections: [], seo: {}},
            {type: 'navigation', id: 'p-child', page: 'B', parent: 'p-root', sections: [], seo: {}},
        ]);
        await service.setParent('p-child', null);
        const doc = await navigation.findOne({id: 'p-child'}) as any;
        expect(doc.parent).toBeUndefined();
    });

    it('rejects a cycle (A → B then B → A)', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'A', page: 'A', sections: [], seo: {}},
            {type: 'navigation', id: 'B', page: 'B', sections: [], seo: {}},
        ]);
        await service.setParent('B', 'A');
        const raw = await service.setParent('A', 'B');
        expect(JSON.parse(raw).error).toBe('cycle');
        const a = await navigation.findOne({id: 'A'}) as any;
        expect(a.parent).toBeUndefined();
    });

    it('rejects beyond max depth (root + 2 child levels = 3, a 4th rejects)', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'L1', page: 'L1', sections: [], seo: {}},
            {type: 'navigation', id: 'L2', page: 'L2', parent: 'L1', sections: [], seo: {}},
            {type: 'navigation', id: 'L3', page: 'L3', parent: 'L2', sections: [], seo: {}},
            {type: 'navigation', id: 'L4', page: 'L4', sections: [], seo: {}},
        ]);
        const raw = await service.setParent('L4', 'L3');
        expect(JSON.parse(raw).error).toBe('depth-cap');
    });

    it('rejects non-existent pageId', async () => {
        const raw = await service.setParent('nope', null);
        expect(JSON.parse(raw).error).toBe('not-found');
    });

    it('rejects non-existent parentId', async () => {
        await navigation.insertOne({type: 'navigation', id: 'X', page: 'X', sections: [], seo: {}});
        const raw = await service.setParent('X', 'missing');
        expect(JSON.parse(raw).error).toBe('not-found');
    });
});

describe('NavigationService.findPageBySlugChain (F1 sub-pages)', () => {
    it('resolves a 3-level chain (root → child → grandchild)', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'r', page: 'Services', slug: 'services', sections: [], seo: {}},
            {type: 'navigation', id: 'c', page: 'Cleaning', slug: 'cleaning', parent: 'r', sections: [], seo: {}},
            {type: 'navigation', id: 'g', page: 'Eco', slug: 'eco', parent: 'c', sections: [], seo: {}},
        ]);
        const found = await service.findPageBySlugChain(['services', 'cleaning', 'eco']);
        expect(found?.id).toBe('g');
    });

    it('returns null when the intermediate parent does not match', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'r', page: 'Services', slug: 'services', sections: [], seo: {}},
            {type: 'navigation', id: 'c', page: 'Cleaning', slug: 'cleaning', parent: 'r', sections: [], seo: {}},
        ]);
        const found = await service.findPageBySlugChain(['nope', 'cleaning']);
        expect(found).toBeNull();
    });

    it('returns null when a leaf segment is missing under the right parent', async () => {
        await navigation.insertOne({type: 'navigation', id: 'r', page: 'Services', slug: 'services', sections: [], seo: {}});
        const found = await service.findPageBySlugChain(['services', 'cleaning']);
        expect(found).toBeNull();
    });

    it('disambiguates same-slug across different parents', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'a', page: 'About', slug: 'about', sections: [], seo: {}},
            {type: 'navigation', id: 's', page: 'Services', slug: 'services', sections: [], seo: {}},
            {type: 'navigation', id: 'a-c', page: 'About Contact', slug: 'contact', parent: 'a', sections: [], seo: {}},
            {type: 'navigation', id: 's-c', page: 'Services Contact', slug: 'contact', parent: 's', sections: [], seo: {}},
        ]);
        const fromAbout = await service.findPageBySlugChain(['about', 'contact']);
        const fromServices = await service.findPageBySlugChain(['services', 'contact']);
        expect(fromAbout?.id).toBe('a-c');
        expect(fromServices?.id).toBe('s-c');
    });

    it('resolves single-segment chains for legacy single-level pages', async () => {
        await navigation.insertOne({type: 'navigation', id: 'h', page: 'Home', slug: 'home', sections: [], seo: {}});
        const found = await service.findPageBySlugChain(['home']);
        expect(found?.id).toBe('h');
    });

    it('falls back to slugified `page` for legacy rows without a slug field', async () => {
        await navigation.insertOne({type: 'navigation', id: 'h', page: 'About Us', sections: [], seo: {}} as any);
        const found = await service.findPageBySlugChain(['about-us']);
        expect(found?.id).toBe('h');
    });

    it('returns null on empty chain', async () => {
        expect(await service.findPageBySlugChain([])).toBeNull();
    });

    // Legacy URL tolerance — live skyclimber.pro / funisimo.pro bundles
    // contain URLs generated by the older builder which preserved
    // diacritics + trailing dashes from trailing whitespace in the page
    // name. Resolver must normalise both sides for the live URL to keep
    // resolving after import (see `normalizeSlugForMatch`).
    it('resolves a legacy URL with percent-encoded diacritics + trailing dash', async () => {
        // Page name carried a trailing space + diacritic, so the live URL
        // is `/jaunumi-un-aktualit%C4%81tes-` but `slugifyAnchor` produces
        // `jaunumi-un-aktualitates` (no diacritic, no trailing dash).
        await navigation.insertOne({
            type: 'navigation', id: 'n', page: 'Jaunumi un aktualitātes ',
            slug: 'jaunumi-un-aktualitates', sections: [], seo: {},
        } as any);
        const found = await service.findPageBySlugChain(['jaunumi-un-aktualit%C4%81tes-']);
        expect(found?.id).toBe('n');
    });

    it('resolves a chain whose segment differs only in case', async () => {
        await navigation.insertOne({
            type: 'navigation', id: 'p', page: 'Pakalpojumi', slug: 'pakalpojumi', sections: [], seo: {},
        });
        const found = await service.findPageBySlugChain(['Pakalpojumi']);
        expect(found?.id).toBe('p');
    });

    it('resolves a chain with raw (decoded) diacritics and no trailing dash', async () => {
        await navigation.insertOne({
            type: 'navigation', id: 'n', page: 'Jaunumi un aktualitātes',
            slug: 'jaunumi-un-aktualitates', sections: [], seo: {},
        });
        const found = await service.findPageBySlugChain(['jaunumi-un-aktualitātes']);
        expect(found?.id).toBe('n');
    });

    it('returns null for a nonexistent chain (negative case)', async () => {
        await navigation.insertOne({
            type: 'navigation', id: 'h', page: 'Home', slug: 'home', sections: [], seo: {},
        });
        expect(await service.findPageBySlugChain(['nonexistent'])).toBeNull();
    });
});

describe('NavigationService — slug uniqueness scoped to parent (F1)', () => {
    it('rejects two siblings sharing a slug at the root', async () => {
        await navigation.insertOne({type: 'navigation', id: 'a', page: 'About', slug: 'about', sections: [], seo: {}});
        // Different `page` (display name) but `slugifyAnchor` produces 'about'.
        const raw = await service.addUpdateNavigationItem('about');
        expect(JSON.parse(raw).error).toBe('slug-conflict');
    });

    it('allows the same slug under different parents', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'a', page: 'About', slug: 'about', sections: [], seo: {}},
            {type: 'navigation', id: 's', page: 'Services', slug: 'services', sections: [], seo: {}},
            {type: 'navigation', id: 'a-c', page: 'AboutContact', slug: 'contact', parent: 'a', sections: [], seo: {}},
            {type: 'navigation', id: 's-c', page: 'ServicesContact', slug: 'contact', parent: 's', sections: [], seo: {}},
        ]);
        // setParent should accept the move because the new sibling set
        // (children of 's') doesn't already contain slug='contact'
        // outside the page itself. Use a fresh page to test cleanly.
        await navigation.insertOne({type: 'navigation', id: 'fresh', page: 'Fresh Contact', slug: 'contact', sections: [], seo: {}});
        const raw = await service.setParent('fresh', 'a');
        // 'a' already has child slug='contact' → conflict
        expect(JSON.parse(raw).error).toBe('slug-conflict');
        // Move under 's' — also conflicts because 's' has child slug='contact'
        const raw2 = await service.setParent('fresh', 's');
        expect(JSON.parse(raw2).error).toBe('slug-conflict');
        // But move under 'a-c' (no children) succeeds
        const raw3 = await service.setParent('fresh', 'a-c');
        expect(JSON.parse(raw3).setParent?.parent).toBe('a-c');
    });

    it('setParent rejects when target parent already has a child with the same slug', async () => {
        await navigation.insertMany([
            {type: 'navigation', id: 'p', page: 'Parent', slug: 'parent', sections: [], seo: {}},
            {type: 'navigation', id: 'c1', page: 'Existing', slug: 'docs', parent: 'p', sections: [], seo: {}},
            {type: 'navigation', id: 'c2', page: 'Newcomer', slug: 'docs', sections: [], seo: {}},
        ]);
        const raw = await service.setParent('c2', 'p');
        expect(JSON.parse(raw).error).toBe('slug-conflict');
    });

    it('addUpdateNavigationItem on an existing row does not trip on its own slug', async () => {
        await navigation.insertOne({type: 'navigation', id: 'h', page: 'Home', slug: 'home', sections: [], seo: {}});
        // Re-saving the same page (existing slug, same parent context)
        // must NOT raise slug-conflict against itself.
        const raw = await service.addUpdateNavigationItem('Home', ['s1']);
        expect(raw).not.toMatch(/slug-conflict/);
    });
});

describe('NavigationService.findPageBySlugChain — per-locale slugs (F1 follow-up)', () => {
    it('matches a Record slug for the requested locale', async () => {
        await navigation.insertOne({
            type: 'navigation', id: 'r', page: 'About', slug: {en: 'about', lv: 'par-mums'}, sections: [], seo: {},
        });
        const en = await service.findPageBySlugChain(['about'], 'en', 'en');
        const lv = await service.findPageBySlugChain(['par-mums'], 'lv', 'en');
        expect(en?.id).toBe('r');
        expect(lv?.id).toBe('r');
    });

    it('falls back to the default-locale entry when the requested locale is missing', async () => {
        await navigation.insertOne({
            type: 'navigation', id: 'r', page: 'About', slug: {en: 'about'}, sections: [], seo: {},
        });
        // request `de` (no entry) → falls back to `en` slug.
        const found = await service.findPageBySlugChain(['about'], 'de', 'en');
        expect(found?.id).toBe('r');
    });

    it('falls back to slugified `page` when the row has no slug at all', async () => {
        await navigation.insertOne({type: 'navigation', id: 'r', page: 'Contact Us', sections: [], seo: {}} as any);
        const found = await service.findPageBySlugChain(['contact-us'], 'en', 'en');
        expect(found?.id).toBe('r');
    });

    it('back-compat — bare-string slug still resolves regardless of locale', async () => {
        await navigation.insertOne({
            type: 'navigation', id: 'r', page: 'Home', slug: 'home', sections: [], seo: {},
        });
        const en = await service.findPageBySlugChain(['home'], 'en', 'en');
        const lv = await service.findPageBySlugChain(['home'], 'lv', 'en');
        expect(en?.id).toBe('r');
        expect(lv?.id).toBe('r');
    });

    it('slugForLocale helper exposes the same fallback chain', async () => {
        const page = {
            id: 'r', type: 'navigation', page: 'About', sections: [], seo: undefined,
            slug: {en: 'about', lv: 'par-mums'},
        } as any;
        expect(service.slugForLocale(page, 'lv', 'en')).toBe('par-mums');
        expect(service.slugForLocale(page, 'de', 'en')).toBe('about');
        const legacy = {id: 'r', type: 'navigation', page: 'No Slug', sections: [], seo: undefined} as any;
        expect(service.slugForLocale(legacy, 'en', 'en')).toBe('no-slug');
    });
});

describe('NavigationService.addUpdateNavigationItem — slug backfill (F1)', () => {
    it('saves a new item with slug = slugifyAnchor(page)', async () => {
        await service.addUpdateNavigationItem('About Us');
        const doc = await navigation.findOne({page: 'About Us'}) as any;
        expect(doc.slug).toBe('about-us');
    });

    it('backfills slug on a legacy row that has none', async () => {
        await navigation.insertOne({type: 'navigation', id: 'legacy', page: 'Old Page', sections: [], seo: {}});
        await service.addUpdateNavigationItem('Old Page', ['s1']);
        const doc = await navigation.findOne({page: 'Old Page'}) as any;
        expect(doc.slug).toBe('old-page');
    });

    it('does not overwrite an existing slug', async () => {
        await navigation.insertOne({
            type: 'navigation', id: 'p1', page: 'Renamed', slug: 'original-slug', sections: [], seo: {},
        });
        await service.addUpdateNavigationItem('Renamed', ['s1']);
        const doc = await navigation.findOne({page: 'Renamed'}) as any;
        expect(doc.slug).toBe('original-slug');
    });
});

describe("NavigationService.reorderPages (F8 W2)", () => {
    it("writes order index onto each row matching its position in orderedIds", async () => {
        await navigation.insertMany([
            {type: "navigation", id: "p1", page: "A", sections: [], seo: {}},
            {type: "navigation", id: "p2", page: "B", sections: [], seo: {}},
            {type: "navigation", id: "p3", page: "C", sections: [], seo: {}},
        ] as any);
        const res = await service.reorderPages(null, ["p3", "p1", "p2"], "tester");
        expect(JSON.parse(res).reorderPages.updated).toBe(3);
        const docs = await navigation.find({type: "navigation"}).toArray() as any[];
        const byId = Object.fromEntries(docs.map(d => [d.id, d.order]));
        expect(byId).toEqual({p1: 1, p2: 2, p3: 0});
    });

    it("scopes by parentId and ignores ids not under that parent", async () => {
        await navigation.insertMany([
            {type: "navigation", id: "root1", page: "R1", sections: [], seo: {}},
            {type: "navigation", id: "c1", page: "C1", parent: "root1", sections: [], seo: {}},
            {type: "navigation", id: "c2", page: "C2", parent: "root1", sections: [], seo: {}},
            {type: "navigation", id: "alien", page: "X", parent: "other", sections: [], seo: {}},
        ] as any);
        const res = await service.reorderPages("root1", ["c2", "c1", "alien"], "tester");
        // alien is silently skipped — only 2 updated.
        expect(JSON.parse(res).reorderPages.updated).toBe(2);
        const c1 = await navigation.findOne({id: "c1"}) as any;
        const c2 = await navigation.findOne({id: "c2"}) as any;
        expect(c1.order).toBe(1);
        expect(c2.order).toBe(0);
    });
});

