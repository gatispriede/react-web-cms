/**
 * Unit tests for `ProductTemplateService` — Phase 1.F.
 * Covers CRUD + cascade-on-delete + duplicate + applyTemplate + seedBuiltIns.
 */
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, type Db} from 'mongodb';
import {ProductTemplateService} from './ProductTemplateService';
import {BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_ID} from './builtInTemplates';

let mongo: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let svc: ProductTemplateService;

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = new MongoClient(mongo.getUri());
    await client.connect();
    db = client.db('test');
});

afterAll(async () => {
    await client.close();
    await mongo.stop();
});

beforeEach(async () => {
    await db.collection('ProductTemplates').deleteMany({});
    await db.collection('Products').deleteMany({});
    svc = new ProductTemplateService(db);
});

describe('seedBuiltIns', () => {
    it('upserts all 5 built-ins idempotently', async () => {
        await svc.seedBuiltIns();
        const list = await svc.list();
        expect(list).toHaveLength(BUILT_IN_TEMPLATES.length);
        expect(list.every(t => t.builtIn)).toBe(true);

        // Second call bumps versions but doesn't duplicate rows.
        await svc.seedBuiltIns();
        const after = await svc.list();
        expect(after).toHaveLength(BUILT_IN_TEMPLATES.length);
        expect(after[0].version).toBeGreaterThanOrEqual(2);
    });
});

describe('CRUD + duplicate', () => {
    it('creates / gets / updates a custom template with version bumps', async () => {
        const created = await svc.create({name: 'My T', audience: 'b2c'}, 'tester@x');
        expect(created.builtIn).toBe(false);
        expect(created.version).toBe(1);

        const fetched = await svc.get(created.id);
        expect(fetched?.name).toBe('My T');

        const updated = await svc.update(
            created.id,
            {name: 'My T (renamed)'},
            created.version,
            'tester@x',
        );
        expect(updated.version).toBe(2);
        expect(updated.name).toBe('My T (renamed)');
    });

    it('rejects update with stale expectedVersion', async () => {
        const t = await svc.create({name: 'Z'});
        await expect(
            svc.update(t.id, {name: 'X'}, 99),
        ).rejects.toThrow(/version conflict/);
    });

    it('duplicates a built-in as a custom (flips builtIn:false)', async () => {
        await svc.seedBuiltIns();
        const dup = await svc.duplicate('built-in:premium', 'Premium Copy', 'tester@x');
        expect(dup.builtIn).toBe(false);
        expect(dup.name).toBe('Premium Copy');
        expect(dup.sections).toEqual(
            (await svc.get('built-in:premium'))!.sections,
        );
    });

    it('rejects delete on built-ins', async () => {
        await svc.seedBuiltIns();
        await expect(svc.delete(DEFAULT_TEMPLATE_ID)).rejects.toThrow(/built-in/);
    });

    it('rejects structural edits on built-ins', async () => {
        await svc.seedBuiltIns();
        await expect(
            svc.update(DEFAULT_TEMPLATE_ID, {sections: []}),
        ).rejects.toThrow(/built-in.*duplicate/);
    });
});

describe('cascadeOnDelete', () => {
    it('resets every product referencing the template to undefined', async () => {
        const t = await svc.create({name: 'Cascade target'});
        await db.collection('Products').insertMany([
            {id: 'p1', templateId: t.id} as any,
            {id: 'p2', templateId: t.id} as any,
            {id: 'p3', templateId: 'other'} as any,
        ]);
        const res = await svc.delete(t.id);
        expect(res.cascadedProducts).toBe(2);
        const remaining = await db.collection('Products').find({}).toArray();
        const byId = Object.fromEntries(remaining.map(p => [p.id, p]));
        expect(byId.p1.templateId).toBeUndefined();
        expect(byId.p2.templateId).toBeUndefined();
        expect(byId.p3.templateId).toBe('other');
    });
});

describe('applyTemplate + getOrDefault', () => {
    it('returns deep-cloned sections (caller can mutate without polluting cache)', async () => {
        await svc.seedBuiltIns();
        const t = (await svc.get(DEFAULT_TEMPLATE_ID))!;
        const fake = {id: 'x', sku: 'x', title: 'x'} as any;
        const out = svc.applyTemplate(t, fake);
        out[0].id = 'mutated';
        const tAgain = (await svc.get(DEFAULT_TEMPLATE_ID))!;
        expect(tAgain.sections[0].id).not.toBe('mutated');
    });

    it('falls back to built-in:standard when id is missing', async () => {
        await svc.seedBuiltIns();
        const t = await svc.getOrDefault(undefined);
        expect(t.id).toBe(DEFAULT_TEMPLATE_ID);
    });

    it('falls back when given an unknown id', async () => {
        await svc.seedBuiltIns();
        const t = await svc.getOrDefault('does-not-exist');
        expect(t.id).toBe(DEFAULT_TEMPLATE_ID);
    });
});

describe('list with includeUsage', () => {
    it('embeds usageCount per template', async () => {
        const t = await svc.create({name: 'Counted'});
        await db.collection('Products').insertMany([
            {id: 'p1', templateId: t.id} as any,
            {id: 'p2', templateId: t.id} as any,
            {id: 'p3'} as any,
        ]);
        const list = await svc.list({includeUsage: true});
        const found = list.find(x => x.id === t.id)!;
        expect(found.usageCount).toBe(2);
    });
});
