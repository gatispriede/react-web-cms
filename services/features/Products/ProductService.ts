import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {IProduct, IProductVariant, InProduct, WarehouseProductInput} from '@interfaces/IProduct';
import {nextVersion, requireVersion} from '@services/infra/conflict';

/**
 * Product service. Mirrors `PostService` for slug/version/conflict handling.
 *
 * - Slug generation uses the same lowercase / 80-char-cap / non-word-strip
 *   shape `PostService.slugify` uses, with the same `-<ts36>` collision
 *   suffix and self-exclusion guard on update.
 * - `save` runs `requireVersion` for optimistic concurrency, mirroring the
 *   Post/Theme contracts.
 * - Warehouse-sourced docs come in through `upsertFromWarehouse` (called by
 *   the inventory adapter, NOT exposed via GraphQL). Field ownership rules
 *   live there — see docs/features/products.md §9.
 */

const slugify = (s: string) =>
    (s || '').toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80);

const escapeRegex = (s: string) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class ProductService {
    private products: Collection;
    private indexesReady = false;

    constructor(db: Db) {
        this.products = db.collection('Products');
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.products.createIndex({id: 1}, {unique: true});
            await this.products.createIndex({slug: 1}, {unique: true});
            await this.products.createIndex({sku: 1}, {unique: true});
            // Sparse so manual products (no externalId) don't collide on the
            // unique constraint — only warehouse rows participate.
            await this.products.createIndex({externalId: 1}, {unique: true, sparse: true});
            await this.products.createIndex({categories: 1});
            await this.products.createIndex({draft: 1, publishedAt: -1});
            this.indexesReady = true;
        } catch (err) {
            console.error('ProductService.ensureIndexes:', err);
        }
    }

    async list(opts: {
        includeDrafts?: boolean;
        limit?: number;
        category?: string;
        inStockOnly?: boolean;
        source?: 'manual' | 'warehouse';
    } = {}): Promise<IProduct[]> {
        await this.ensureIndexes();
        const {includeDrafts = false, limit = 50, category, inStockOnly, source} = opts;
        const cap = Math.max(1, Math.min(500, Math.floor(limit) || 50));
        const query: any = {};
        if (!includeDrafts) query.draft = {$ne: true};
        if (category) query.categories = category;
        if (inStockOnly) query.stock = {$gt: 0};
        if (source) query.source = source;
        const docs = await this.products
            .find(query, {projection: {_id: 0}})
            .sort({publishedAt: -1, createdAt: -1})
            .limit(cap)
            .toArray();
        return docs.map(d => this.normalize(d));
    }

    async getBySlug(slug: string, {includeDrafts = false}: {includeDrafts?: boolean} = {}): Promise<IProduct | null> {
        await this.ensureIndexes();
        const query: any = {slug};
        if (!includeDrafts) query.draft = {$ne: true};
        const doc = await this.products.findOne(query, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    async getById(id: string): Promise<IProduct | null> {
        await this.ensureIndexes();
        const doc = await this.products.findOne({id}, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    async getBySku(sku: string): Promise<IProduct | null> {
        await this.ensureIndexes();
        const doc = await this.products.findOne({sku}, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    async search(q: string, {limit = 50, includeDrafts = false}: {limit?: number; includeDrafts?: boolean} = {}): Promise<IProduct[]> {
        await this.ensureIndexes();
        const cap = Math.max(1, Math.min(500, Math.floor(limit) || 50));
        const trimmed = (q || '').trim();
        if (!trimmed) return [];
        // DECISION: regex over title/sku is fine for v1 catalogs (<10k rows).
        // At scale this would move to Atlas Search — see spec §10.4.
        const rx = new RegExp(escapeRegex(trimmed), 'i');
        const query: any = {$or: [{title: rx}, {sku: rx}]};
        if (!includeDrafts) query.draft = {$ne: true};
        const docs = await this.products
            .find(query, {projection: {_id: 0}})
            .limit(cap)
            .toArray();
        return docs.map(d => this.normalize(d));
    }

    async save(product: InProduct, editedBy?: string, expectedVersion?: number | null): Promise<{id: string; version: number; slug: string}> {
        await this.ensureIndexes();
        const title = (product.title || '').trim();
        if (!title) throw new Error('title is required');
        const sku = (product.sku || '').trim();
        if (!sku) throw new Error('sku is required');
        const currency = (product.currency || '').trim();
        if (!currency) throw new Error('currency is required');
        if (typeof product.price !== 'number' || !Number.isFinite(product.price)) {
            throw new Error('price is required');
        }
        const now = new Date().toISOString();
        let slug = (product.slug || slugify(title)).trim();
        if (!slug) slug = slugify(title) || guid().slice(0, 8);
        // Same self-exclusion guard as `PostService.save` — only exclude
        // self when we actually have an id, so a malformed update doesn't
        // collide-rename a doc against its own slug.
        const selfId = product.id;
        const collisionQuery = selfId ? {slug, id: {$ne: selfId}} : {slug};
        const collision = await this.products.findOne(collisionQuery);
        if (collision) slug = `${slug}-${Date.now().toString(36)}`;

        if (product.id) {
            const existing = await this.products.findOne({id: product.id});
            if (!existing) throw new Error('product not found');
            const existingVersion = (existing as any).version as number | undefined;
            requireVersion(existing, existingVersion, expectedVersion, `Product "${title}"`);
            const version = nextVersion(existingVersion);
            const update: Partial<IProduct> & {editedBy?: string; version?: number} = {
                slug,
                sku,
                title,
                description: product.description ?? (existing as any).description ?? '',
                price: product.price,
                currency,
                stock: typeof product.stock === 'number' ? product.stock : (existing as any).stock ?? 0,
                images: product.images ?? (existing as any).images ?? [],
                categories: product.categories ?? (existing as any).categories ?? [],
                attributes: product.attributes ?? (existing as any).attributes ?? {},
                variants: product.variants ?? (existing as any).variants ?? [],
                source: product.source ?? (existing as any).source ?? 'manual',
                manualOverrides: product.manualOverrides ?? (existing as any).manualOverrides ?? [],
                draft: product.draft ?? (existing as any).draft ?? false,
                updatedAt: now,
                version,
            };
            if (editedBy) update.editedBy = editedBy;
            if (product.publishedAt !== undefined) update.publishedAt = product.publishedAt;
            if (update.draft === false && !(existing as any).publishedAt) update.publishedAt = now;
            // Same sparse-index reason as the insert path — only $set
            // externalId when the caller explicitly provided one.
            const existingExternalId = (existing as any).externalId as string | undefined;
            const externalId = product.externalId ?? existingExternalId;
            const setOps: any = {...update};
            if (externalId) setOps.externalId = externalId;
            await this.products.updateOne({id: product.id}, {$set: setOps});
            return {id: product.id, version, slug};
        }

        const id = guid();
        const draft = product.draft ?? false;
        const doc: IProduct & {editedBy?: string; version?: number} = {
            id,
            sku,
            slug,
            title,
            description: product.description ?? '',
            price: product.price,
            currency,
            stock: product.stock ?? 0,
            images: product.images ?? [],
            categories: product.categories ?? [],
            attributes: product.attributes ?? {},
            variants: product.variants ?? [],
            source: product.source ?? 'manual',
            // Sparse unique index on externalId requires the field to be
            // ABSENT (not null) for non-warehouse rows — Mongo's sparse
            // index treats `null` as a real value and would collide across
            // every manual product. Only stamp it when the caller set one.
            ...(product.externalId ? {externalId: product.externalId} : {}),
            manualOverrides: product.manualOverrides ?? [],
            publishedAt: product.publishedAt ?? (draft ? undefined : now),
            draft,
            createdAt: now,
            updatedAt: now,
            version: 1,
            ...(editedBy ? {editedBy} : {}),
        };
        await this.products.insertOne(doc as any);
        return {id, version: 1, slug};
    }

    async remove(id: string, deletedBy?: string): Promise<{id: string; deleted: number; deletedBy?: string}> {
        const result = await this.products.deleteOne({id});
        return {id, deleted: result.deletedCount ?? 0, ...(deletedBy ? {deletedBy} : {})};
    }

    async setPublished(id: string, publish: boolean, editedBy?: string): Promise<{id: string; draft: boolean}> {
        const existing = await this.products.findOne({id});
        if (!existing) throw new Error('product not found');
        const update: any = {draft: !publish, updatedAt: new Date().toISOString()};
        if (editedBy) update.editedBy = editedBy;
        if (publish && !(existing as any).publishedAt) update.publishedAt = new Date().toISOString();
        await this.products.updateOne({id}, {$set: update});
        return {id, draft: update.draft};
    }

    /**
     * Upsert from the warehouse adapter. Match key is
     * `{source: 'warehouse', externalId}`. Field-ownership rules per
     * docs/features/products.md §9:
     *   - On INSERT: full doc, draft=true (so a human reviews before publish).
     *   - On UPDATE: only warehouse-authoritative fields are overwritten
     *     (sku, price, stock, images, attributes, variants, currency).
     *     Admin-curated fields (slug, categories, description, draft, title
     *     once edited) are preserved. `title` is warehouse-on-insert-only
     *     and becomes manual after.
     */
    async upsertFromWarehouse(input: WarehouseProductInput): Promise<{id: string; version: number; created: boolean}> {
        await this.ensureIndexes();
        const externalId = (input.externalId || '').trim();
        if (!externalId) throw new Error('externalId is required');
        const now = new Date().toISOString();
        const existing = await this.products.findOne({source: 'warehouse', externalId});
        if (!existing) {
            // First-time insert. Generate slug from title at this point only
            // — slug is sticky across syncs, see §9.
            const title = (input.title || '').trim() || `product-${externalId}`;
            let slug = slugify(title) || guid().slice(0, 8);
            const collision = await this.products.findOne({slug});
            if (collision) slug = `${slug}-${Date.now().toString(36)}`;
            const id = guid();
            const doc: IProduct & {editedBy?: string} = {
                id,
                sku: input.sku,
                slug,
                title,
                description: '',
                price: input.price,
                currency: input.currency,
                stock: input.stock,
                images: input.images ?? [],
                categories: [],
                attributes: input.attributes ?? {},
                variants: input.variants ?? [],
                source: 'warehouse',
                externalId,
                manualOverrides: [],
                draft: true,
                createdAt: now,
                updatedAt: now,
                version: 1,
                editedBy: 'warehouse-adapter',
            };
            await this.products.insertOne(doc as any);
            return {id, version: 1, created: true};
        }
        // Update path: only $set the warehouse-owned fields.
        const existingVersion = (existing as any).version as number | undefined;
        const version = nextVersion(existingVersion);
        const overrides = new Set(((existing as any).manualOverrides as string[]) ?? []);
        const update: any = {
            currency: input.currency,
            updatedAt: now,
            version,
            editedBy: 'warehouse-adapter',
        };
        // Each warehouse-owned field can be pinned via `manualOverrides` to
        // make the field sticky against future syncs (inventory module's
        // per-field opt-out — baked into the upsert here so a follow-up
        // module doesn't have to retrofit).
        if (!overrides.has('sku')) update.sku = input.sku;
        if (!overrides.has('price')) update.price = input.price;
        if (!overrides.has('stock')) update.stock = input.stock;
        if (!overrides.has('images')) update.images = input.images ?? [];
        if (!overrides.has('attributes')) update.attributes = input.attributes ?? {};
        if (!overrides.has('variants')) update.variants = input.variants ?? [];
        await this.products.updateOne({id: (existing as any).id}, {$set: update});
        return {id: (existing as any).id, version, created: false};
    }

    private normalize(d: any): IProduct {
        return {
            id: d.id,
            sku: d.sku ?? '',
            slug: d.slug,
            title: d.title ?? '',
            description: d.description ?? '',
            price: typeof d.price === 'number' ? d.price : 0,
            currency: d.currency ?? '',
            stock: typeof d.stock === 'number' ? d.stock : 0,
            images: Array.isArray(d.images) ? d.images : [],
            categories: Array.isArray(d.categories) ? d.categories : [],
            attributes: d.attributes && typeof d.attributes === 'object' ? d.attributes : {},
            variants: Array.isArray(d.variants) ? d.variants : [],
            source: d.source === 'warehouse' ? 'warehouse' : 'manual',
            externalId: d.externalId,
            manualOverrides: Array.isArray(d.manualOverrides) ? d.manualOverrides : [],
            draft: Boolean(d.draft),
            publishedAt: d.publishedAt,
            createdAt: d.createdAt ?? '',
            updatedAt: d.updatedAt ?? '',
            version: d.version ?? 0,
            editedBy: d.editedBy,
            editedAt: d.editedAt ?? d.updatedAt,
        };
    }
}
