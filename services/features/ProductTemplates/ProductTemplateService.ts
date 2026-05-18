/**
 * `ProductTemplateService` — CRUD over `IProductTemplate` rows.
 * Phase 1.F (product-display-templates).
 *
 *   - List / get / create / update / delete with optimistic-concurrency
 *     bumps (`version`).
 *   - `duplicate(fromId, newName)` — clone any (built-in or custom) row
 *     as a fresh `builtIn: false` custom template.
 *   - `cascadeOnDelete(templateId)` — reset `IProduct.templateId === id`
 *     to undefined so the default fallback (`built-in:standard`) kicks
 *     back in. Mirrors the cascade-engine pattern; called from `delete`.
 *   - `applyTemplate(template, product)` — pure: returns the template's
 *     sections with shallow product-data bound onto each module's
 *     content as a sibling `__product` slot. Re-binding at render time
 *     keeps templates language-agnostic.
 *   - `seedBuiltIns()` — idempotent upsert called at boot. Built-ins
 *     refresh their `sections` on every boot so platform updates land
 *     without an operator action.
 *   - `getOrDefault(id?)` — picker resolver: returns the template or
 *     the `built-in:standard` fallback.
 *
 * Mongo collection: `ProductTemplates`. Unique index on `id`.
 *
 * Operators cannot delete built-ins — `delete` rejects when
 * `builtIn: true` (same lock pattern Phase 0a uses for system pages).
 */

import type {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {log} from '@services/infra/logger';
import type {
    IProductTemplate,
    InProductTemplate,
    TemplateAudience,
} from '@interfaces/IProductTemplate';
import {TEMPLATE_AUDIENCES} from '@interfaces/IProductTemplate';
import type {IProduct} from '@interfaces/IProduct';
import type {ISection} from '@interfaces/ISection';
import {BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_ID} from './builtInTemplates';

const COLLECTION = 'ProductTemplates';
const PRODUCTS_COLLECTION = 'Products';
const TRASH_COLLECTION = 'ProductTemplates.trash';
const TRASH_TTL_SECONDS = 86_400; // 24h — matches cascadeDelete engine.

/** Soft-delete snapshot shape — stored in `ProductTemplates.trash`. */
export interface ProductTemplateTrashEntry {
    trashId: string;
    deletedAt: Date;
    template: IProductTemplate;
    affectedProductIds: string[];
}

export interface ProductTemplateListOpts {
    audience?: TemplateAudience;
    /** When true, include a `usageCount` per template (how many products refer to it). */
    includeUsage?: boolean;
}

export interface ProductTemplateListItem extends IProductTemplate {
    usageCount?: number;
}

export class ProductTemplateService {
    constructor(private readonly db: Db) {}

    private col(): Collection<IProductTemplate> {
        return this.db.collection<IProductTemplate>(COLLECTION);
    }

    private products(): Collection<IProduct> {
        return this.db.collection<IProduct>(PRODUCTS_COLLECTION);
    }

    private trash(): Collection<ProductTemplateTrashEntry> {
        return this.db.collection<ProductTemplateTrashEntry>(TRASH_COLLECTION);
    }

    private trashIndexEnsured = false;
    private async ensureTrashIndex(): Promise<void> {
        if (this.trashIndexEnsured) return;
        try {
            await this.trash().createIndex({deletedAt: 1}, {expireAfterSeconds: TRASH_TTL_SECONDS});
            await this.trash().createIndex({trashId: 1}, {unique: true});
            this.trashIndexEnsured = true;
        } catch (err) {
            log.warn({scope: 'productTemplate.trashIndex', err}, 'trash index ensure failed');
        }
    }

    // ─── Read ───────────────────────────────────────────────────────

    async list(opts: ProductTemplateListOpts = {}): Promise<ProductTemplateListItem[]> {
        const filter: Record<string, unknown> = {};
        if (opts.audience) {
            if (!TEMPLATE_AUDIENCES.includes(opts.audience)) {
                throw new Error(`unknown template audience: ${opts.audience}`);
            }
            filter.audience = opts.audience;
        }
        const docs = await this.col().find(filter as any).sort({builtIn: -1, name: 1}).toArray();
        const out: ProductTemplateListItem[] = docs.map(d => this.strip(d));
        if (opts.includeUsage) {
            await Promise.all(out.map(async t => {
                t.usageCount = await this.products().countDocuments({templateId: t.id} as any);
            }));
        }
        return out;
    }

    async get(id: string): Promise<IProductTemplate | null> {
        const doc = await this.col().findOne({id});
        return doc ? this.strip(doc) : null;
    }

    /** Resolve the picker: explicit id wins, else the built-in:standard fallback. */
    async getOrDefault(id?: string | null): Promise<IProductTemplate> {
        if (id) {
            const t = await this.get(id);
            if (t) return t;
            log.warn({scope: 'productTemplate.getOrDefault', id}, 'unknown template id — falling back to default');
        }
        const fallback = await this.get(DEFAULT_TEMPLATE_ID);
        if (fallback) return fallback;
        // Pre-seed safety — return the in-memory built-in.
        const inMem = BUILT_IN_TEMPLATES.find(t => t.id === DEFAULT_TEMPLATE_ID);
        if (!inMem) throw new Error('built-in:standard missing from registry');
        return inMem;
    }

    // ─── Write ──────────────────────────────────────────────────────

    async create(input: InProductTemplate, actor?: string): Promise<IProductTemplate> {
        const name = (input.name ?? '').trim();
        if (!name) throw new Error('productTemplate.name is required');
        const audience: TemplateAudience = input.audience ?? 'either';
        if (!TEMPLATE_AUDIENCES.includes(audience)) {
            throw new Error(`unknown template audience: ${audience}`);
        }
        const now = new Date().toISOString();
        const doc: IProductTemplate = {
            id: input.id ?? `custom-${guid()}`,
            name,
            description: input.description?.trim() ?? '',
            thumbnailImageId: input.thumbnailImageId,
            audience,
            applicableTo: input.applicableTo ?? {},
            sections: input.sections ?? [],
            builtIn: false,
            createdAt: now,
            updatedAt: now,
            version: 1,
            editedBy: actor,
        };
        await this.col().insertOne(doc as any);
        return doc;
    }

    async update(
        id: string,
        patch: Partial<InProductTemplate>,
        expectedVersion?: number,
        actor?: string,
    ): Promise<IProductTemplate> {
        const current = await this.requireExisting(id, expectedVersion);
        if (current.builtIn && (patch.sections || patch.applicableTo || patch.audience)) {
            // Built-ins refresh from `seedBuiltIns()` on boot; reject structural
            // edits so operators don't lose them on the next deploy.
            throw new Error('built-in templates cannot be edited — duplicate first');
        }
        const next: Partial<IProductTemplate> = {
            updatedAt: new Date().toISOString(),
            version: current.version + 1,
            editedBy: actor,
        };
        if (typeof patch.name === 'string') next.name = patch.name.trim();
        if (typeof patch.description === 'string') next.description = patch.description.trim();
        if (typeof patch.thumbnailImageId === 'string') next.thumbnailImageId = patch.thumbnailImageId;
        if (patch.audience !== undefined) {
            if (!TEMPLATE_AUDIENCES.includes(patch.audience)) {
                throw new Error(`unknown template audience: ${patch.audience}`);
            }
            next.audience = patch.audience;
        }
        if (patch.applicableTo) next.applicableTo = patch.applicableTo;
        if (patch.sections) next.sections = patch.sections;

        const res = await this.col().updateOne(
            {id, version: current.version},
            {$set: next as any},
        );
        if (res.matchedCount !== 1) {
            throw new Error(`productTemplate ${id} version conflict (expected ${current.version})`);
        }
        return (await this.get(id))!;
    }

    /** Soft-delete intentionally NOT implemented separately — `delete` cascades. */
    async delete(id: string): Promise<{cascadedProducts: number}> {
        const t = await this.get(id);
        if (!t) return {cascadedProducts: 0};
        if (t.builtIn) {
            throw new Error('built-in templates cannot be deleted');
        }
        const cascadedProducts = await this.cascadeOnDelete(id);
        await this.col().deleteOne({id});
        log.info({scope: 'productTemplate.delete', id, cascadedProducts}, 'template deleted + products reset');
        return {cascadedProducts};
    }

    /**
     * Soft-delete a custom template: snapshot the template + the list of
     * products that reference it into `ProductTemplates.trash` (24h TTL),
     * then run the same cascade-reset + hard-delete `delete()` does. The
     * returned `trashId` is the key the operator passes to `restore()` to
     * undo within 24h. Built-ins reject — same lock as `delete()`.
     */
    async softDelete(id: string): Promise<{trashId: string; cascadedProducts: number}> {
        const t = await this.get(id);
        if (!t) throw new Error(`productTemplate not found: ${id}`);
        if (t.builtIn) throw new Error('built-in templates cannot be deleted');
        await this.ensureTrashIndex();
        const affected = await this.products()
            .find({templateId: id} as any, {projection: {id: 1}})
            .toArray();
        const affectedProductIds = affected.map(d => (d as any).id).filter(Boolean);
        const trashId = `tpl-trash-${guid()}`;
        await this.trash().insertOne({
            trashId,
            deletedAt: new Date(),
            template: t,
            affectedProductIds,
        } as any);
        const cascadedProducts = await this.cascadeOnDelete(id);
        await this.col().deleteOne({id});
        log.info(
            {scope: 'productTemplate.softDelete', id, trashId, cascadedProducts},
            'template soft-deleted (24h TTL) + products reset',
        );
        return {trashId, cascadedProducts};
    }

    /**
     * Restore a soft-deleted template by re-inserting the snapshot and
     * re-linking every product captured in `affectedProductIds`. Idempotent
     * on the products (re-running just re-sets the same templateId), and on
     * the template (existing row with the same id wins — no clobber).
     */
    async restore(trashId: string): Promise<{templateId: string; restoredProducts: number}> {
        const entry = await this.trash().findOne({trashId});
        if (!entry) throw new Error(`trash entry not found: ${trashId}`);
        const tpl = (entry as any).template as IProductTemplate;
        const affectedProductIds: string[] = Array.isArray((entry as any).affectedProductIds)
            ? (entry as any).affectedProductIds : [];
        const existing = await this.col().findOne({id: tpl.id});
        if (!existing) {
            await this.col().insertOne(tpl as any);
        }
        let restoredProducts = 0;
        if (affectedProductIds.length) {
            const res = await this.products().updateMany(
                {id: {$in: affectedProductIds}} as any,
                {$set: {templateId: tpl.id}} as any,
            );
            restoredProducts = res.modifiedCount;
        }
        await this.trash().deleteOne({trashId});
        log.info(
            {scope: 'productTemplate.restore', trashId, templateId: tpl.id, restoredProducts},
            'template restored from trash + products re-linked',
        );
        return {templateId: tpl.id, restoredProducts};
    }

    /** Reset every product referencing `templateId` to the default fallback. */
    async cascadeOnDelete(templateId: string): Promise<number> {
        const res = await this.products().updateMany(
            {templateId} as any,
            {$unset: {templateId: ''}} as any,
        );
        return res.modifiedCount;
    }

    /** Clone any template as a fresh custom row. */
    async duplicate(fromId: string, newName: string, actor?: string): Promise<IProductTemplate> {
        const src = await this.get(fromId);
        if (!src) throw new Error(`productTemplate not found: ${fromId}`);
        const cleanName = (newName ?? '').trim() || `${src.name} (copy)`;
        return this.create({
            name: cleanName,
            description: src.description,
            thumbnailImageId: src.thumbnailImageId,
            audience: src.audience,
            applicableTo: src.applicableTo,
            sections: cloneSections(src.sections),
        }, actor);
    }

    // ─── Render binding ─────────────────────────────────────────────

    /**
     * Pure function — bind product data onto each section's items. Today
     * we leave sections unmutated and rely on `ProductContext` for the
     * runtime data binding; this method exists as the documented seam
     * for future template-level slot substitution (e.g. `{{product.name}}`
     * in RichText bodies, per spec §"Section data binding").
     */
    applyTemplate(template: IProductTemplate, product: IProduct): ISection[] {
        // No-op transform — `ProductContext.Provider` (set by the leaf
        // page renderer) is the single source of product truth at render
        // time. Returning a deep clone keeps the call site free to mutate
        // without polluting the cached template doc.
        void product;
        return cloneSections(template.sections);
    }

    // ─── Boot ───────────────────────────────────────────────────────

    /**
     * Idempotent upsert of the 5 built-in templates. Called from
     * `ProductTemplatesServiceLoader.onBoot`. Always overwrites built-in
     * rows so platform updates land without an operator action; never
     * touches custom templates.
     */
    async seedBuiltIns(): Promise<void> {
        const now = new Date().toISOString();
        for (const t of BUILT_IN_TEMPLATES) {
            const existing = await this.col().findOne({id: t.id});
            const version = (existing?.version ?? 0) + 1;
            const doc: IProductTemplate = {
                ...t,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
                version,
            };
            await this.col().updateOne(
                {id: t.id},
                {$set: doc as any},
                {upsert: true},
            );
        }
        log.info(
            {scope: 'productTemplate.seedBuiltIns', count: BUILT_IN_TEMPLATES.length},
            'built-in product templates seeded',
        );
    }

    // ─── Helpers ────────────────────────────────────────────────────

    private async requireExisting(id: string, expectedVersion?: number): Promise<IProductTemplate> {
        const t = await this.get(id);
        if (!t) throw new Error(`productTemplate not found: ${id}`);
        if (expectedVersion !== undefined && t.version !== expectedVersion) {
            throw new Error(`productTemplate version conflict (have ${t.version}, expected ${expectedVersion})`);
        }
        return t;
    }

    private strip(doc: any): IProductTemplate {
        const clone = {...(doc as Record<string, unknown>)};
        delete (clone as any)._id;
        return clone as unknown as IProductTemplate;
    }
}

/** Deep-clone sections via the structured-clone JSON dance — section
 *  shape is JSON-safe so this is cheap and side-effect-free. */
function cloneSections(sections: ISection[]): ISection[] {
    return sections.map(s => JSON.parse(JSON.stringify(s)) as ISection);
}
