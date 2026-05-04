import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {MongoClient, Db} from 'mongodb';
import {ProductService} from '@services/features/Products/ProductService';
import {guardMethods, MUTATION_REQUIREMENTS, AuthzError} from '@services/features/Auth/authz';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;
let service: ProductService;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
    await client?.close();
    await mongod?.stop();
});

beforeEach(async () => {
    db = client.db(`product_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
    service = new ProductService(db);
});

const baseInput = (overrides: any = {}) => ({
    sku: 'SKU-1',
    title: 'Sample Product',
    price: 1000,
    currency: 'EUR',
    ...overrides,
});

describe('ProductService', () => {
    it('save creates a product, generates slug, stamps timestamps and version=1', async () => {
        const res = await service.save(baseInput());
        expect(res.id).toBeTruthy();
        expect(res.version).toBe(1);
        expect(res.slug).toBe('sample-product');
        const doc = await service.getById(res.id);
        expect(doc?.title).toBe('Sample Product');
        expect(doc?.createdAt).toBeTruthy();
        expect(doc?.updatedAt).toBeTruthy();
        expect(doc?.version).toBe(1);
        expect(doc?.source).toBe('manual');
    });

    it('save with existing id bumps version and respects requireVersion', async () => {
        const created = await service.save(baseInput());
        const updated = await service.save(
            {...baseInput({sku: 'SKU-1', title: 'Sample Product'}), id: created.id, description: 'updated'},
            'editor@x',
            1,
        );
        expect(updated.version).toBe(2);
        await expect(
            service.save(
                {...baseInput({sku: 'SKU-1', title: 'Sample Product'}), id: created.id, description: 'stale'},
                'editor@x',
                1, // stale — server is now on version 2
            ),
        ).rejects.toMatchObject({conflict: true});
    });

    it('slug collision bumps with -<ts36> suffix; self-update keeps slug', async () => {
        const first = await service.save(baseInput({title: 'My Item', sku: 'SKU-A'}));
        expect(first.slug).toBe('my-item');
        const second = await service.save(baseInput({title: 'My Item', sku: 'SKU-B'}));
        expect(second.slug).toMatch(/^my-item-[a-z0-9]+$/);
        // Self-update keeps the slug — collision query excludes self.
        const again = await service.save({...baseInput({title: 'My Item', sku: 'SKU-A'}), id: first.id});
        expect(again.slug).toBe('my-item');
    });

    it('getBySlug filters drafts unless includeDrafts is true', async () => {
        const r = await service.save(baseInput({title: 'Draft', sku: 'D-1', draft: true}));
        expect(await service.getBySlug('draft')).toBeNull();
        const got = await service.getBySlug('draft', {includeDrafts: true});
        expect(got?.id).toBe(r.id);
    });

    it('getBySku returns by sku', async () => {
        await service.save(baseInput({sku: 'UNIQUE-1', title: 'U'}));
        const got = await service.getBySku('UNIQUE-1');
        expect(got?.title).toBe('U');
    });

    it('list filters by category, inStockOnly, source', async () => {
        await service.save(baseInput({sku: 'A', title: 'A', categories: ['shoes'], stock: 5}));
        await service.save(baseInput({sku: 'B', title: 'B', categories: ['hats'], stock: 0}));
        await service.save(baseInput({sku: 'C', title: 'C', categories: ['shoes'], stock: 0}));
        // Insert a warehouse-sourced doc directly via the adapter path.
        await service.upsertFromWarehouse({
            externalId: 'EXT-1', sku: 'W-1', title: 'Warehouse Item',
            price: 500, currency: 'EUR', stock: 3,
        });
        const shoes = await service.list({category: 'shoes', includeDrafts: true});
        expect(shoes.map(p => p.sku).sort()).toEqual(['A', 'C']);
        const inStock = await service.list({inStockOnly: true, includeDrafts: true});
        expect(inStock.every(p => p.stock > 0)).toBe(true);
        const warehouse = await service.list({source: 'warehouse', includeDrafts: true});
        expect(warehouse.length).toBe(1);
        expect(warehouse[0].source).toBe('warehouse');
    });

    it('search matches on title/sku case-insensitively', async () => {
        await service.save(baseInput({sku: 'SKU-LANTERN', title: 'Brass Lantern'}));
        await service.save(baseInput({sku: 'SKU-CHAIR', title: 'Oak Chair'}));
        const t = await service.search('lantern');
        expect(t.length).toBe(1);
        expect(t[0].title).toBe('Brass Lantern');
        const s = await service.search('sku-CHAIR');
        expect(s.length).toBe(1);
        expect(s[0].sku).toBe('SKU-CHAIR');
    });

    it('remove deletes by id', async () => {
        const r = await service.save(baseInput());
        const out = await service.remove(r.id);
        expect(out.deleted).toBe(1);
        expect(await service.getById(r.id)).toBeNull();
    });

    it('setPublished flips draft and stamps publishedAt on first publish only', async () => {
        const r = await service.save(baseInput({draft: true}));
        const first = await service.setPublished(r.id, true);
        expect(first.draft).toBe(false);
        const after = await service.getById(r.id);
        const initialPublishedAt = after?.publishedAt;
        expect(initialPublishedAt).toBeTruthy();
        // Unpublish/republish — publishedAt must NOT update on second publish.
        await service.setPublished(r.id, false);
        await new Promise(r => setTimeout(r, 5));
        await service.setPublished(r.id, true);
        const final = await service.getById(r.id);
        expect(final?.publishedAt).toBe(initialPublishedAt);
    });

    describe('upsertFromWarehouse', () => {
        it('inserts a new doc with source=warehouse, draft=true, externalId set', async () => {
            const res = await service.upsertFromWarehouse({
                externalId: 'EXT-A', sku: 'W-A', title: 'Imported Item',
                price: 1500, currency: 'EUR', stock: 7,
            });
            expect(res.created).toBe(true);
            const doc = await service.getById(res.id);
            expect(doc?.source).toBe('warehouse');
            expect(doc?.draft).toBe(true);
            expect(doc?.externalId).toBe('EXT-A');
            expect(doc?.editedBy).toBe('warehouse-adapter');
        });

        it('re-running with same externalId updates price/stock/images but preserves admin-edited categories and description', async () => {
            const first = await service.upsertFromWarehouse({
                externalId: 'EXT-B', sku: 'W-B', title: 'Initial',
                price: 1000, currency: 'EUR', stock: 5,
            });
            // Admin edits manual fields.
            await service.save({
                id: first.id,
                sku: 'W-B',
                title: 'Initial',
                price: 1000,
                currency: 'EUR',
                description: 'admin curated copy',
                categories: ['featured', 'sale'],
                source: 'warehouse',
                externalId: 'EXT-B',
            }, 'admin@x');
            const second = await service.upsertFromWarehouse({
                externalId: 'EXT-B', sku: 'W-B-NEW', title: 'IGNORED on update',
                price: 1234, currency: 'EUR', stock: 9,
                images: ['http://example.com/a.jpg'],
            });
            expect(second.created).toBe(false);
            const doc = await service.getById(first.id);
            expect(doc?.price).toBe(1234);
            expect(doc?.stock).toBe(9);
            expect(doc?.sku).toBe('W-B-NEW');
            expect(doc?.images).toEqual(['http://example.com/a.jpg']);
            // Admin-curated fields preserved.
            expect(doc?.description).toBe('admin curated copy');
            expect(doc?.categories).toEqual(['featured', 'sale']);
            expect(doc?.editedBy).toBe('warehouse-adapter');
            // slug stays stable across the sync (per §9).
            expect(doc?.slug).toBe('initial');
        });

        it('stamps editedBy=warehouse-adapter on insert and update', async () => {
            const inserted = await service.upsertFromWarehouse({
                externalId: 'EXT-C', sku: 'W-C', title: 'C',
                price: 100, currency: 'EUR', stock: 1,
            });
            const after1 = await service.getById(inserted.id);
            expect(after1?.editedBy).toBe('warehouse-adapter');
            await service.upsertFromWarehouse({
                externalId: 'EXT-C', sku: 'W-C', title: 'C',
                price: 200, currency: 'EUR', stock: 2,
            });
            const after2 = await service.getById(inserted.id);
            expect(after2?.editedBy).toBe('warehouse-adapter');
        });
    });

    describe('authz integration', () => {
        // Mirrors how `mongoDBConnection.ts` exposes `saveProduct` — a thin
        // wrapper that runMutation-wraps the underlying ProductService.save.
        // The proxy gates by method name on the target, so we replicate that
        // shape here rather than calling `service.save` directly (which is
        // not in MUTATION_REQUIREMENTS).
        const makeWrapped = () => ({
            saveProduct: async ({product, _session}: any) =>
                service.save(product, _session?.email, null),
        });

        it('guardMethods rejects saveProduct for editor session and admits admin', async () => {
            const editorGuard = guardMethods<any>(makeWrapped(), {kind: 'admin', role: 'editor', email: 'e@x'}, MUTATION_REQUIREMENTS);
            // The proxy returns a sync-throwing fn for forbidden methods, so
            // wrap to surface the throw to the matcher.
            expect(() => editorGuard.saveProduct({product: baseInput()})).toThrow(AuthzError);

            const adminGuard = guardMethods<any>(makeWrapped(), {kind: 'admin', role: 'admin', email: 'a@x'}, MUTATION_REQUIREMENTS);
            const created = await adminGuard.saveProduct({product: baseInput({sku: 'AUTH-1', title: 'Auth'})});
            expect(created.id).toBeTruthy();
        });
    });
});
