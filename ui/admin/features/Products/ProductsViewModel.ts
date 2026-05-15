import {notifyError, notifySuccess, notifyWarning} from '@admin/lib/notify';
import ProductApi from '@services/api/client/ProductApi';
import {IProduct, InProduct} from '@interfaces/IProduct';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

export const WAREHOUSE_OWNED_FIELDS: ReadonlyArray<keyof InProduct> = [
    'price', 'stock', 'sku', 'images', 'attributes', 'variants',
];

export type EditingProduct = Partial<InProduct & {source?: 'manual' | 'warehouse'}>;

export interface ProductConflict {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

/** VM3 — Products admin pane state. */
export class ProductsViewModel {
    products: IProduct[] = [];
    loading = false;
    saving = false;
    editing: EditingProduct | null = null;
    editingVersion: number | undefined = undefined;
    conflict: ProductConflict | null = null;
    search = '';

    constructor(
        private readonly api: ProductApi = new ProductApi(),
        private readonly t: (k: string, opts?: Record<string, unknown>) => string = (k) => k,
    ) {
        return observable(this);
    }

    setSearch(v: string): void { this.search = v; }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.products = await this.api.list({includeDrafts: true, limit: 200});
        } finally {
            this.loading = false;
        }
    }

    get filtered(): IProduct[] {
        if (!this.search.trim()) return this.products;
        const q = this.search.trim().toLowerCase();
        return this.products.filter(p =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q),
        );
    }

    get latestAudit(): {editedBy?: string; editedAt?: string} {
        let best: {editedBy?: string; editedAt?: string} = {};
        for (const p of this.products) {
            const at = p.editedAt ?? p.updatedAt;
            if (at && (!best.editedAt || at > best.editedAt)) best = {editedBy: p.editedBy, editedAt: at};
        }
        return best;
    }

    get isWarehouse(): boolean {
        return this.editing?.source === 'warehouse';
    }

    fieldDisabled(name: keyof InProduct): boolean {
        return this.isWarehouse && (WAREHOUSE_OWNED_FIELDS as readonly string[]).includes(name as string);
    }

    openCreate(): void {
        this.editing = {draft: true, source: 'manual', currency: 'EUR', price: 0, stock: 0, categories: [], images: [], attributes: {}, variants: []};
        this.editingVersion = undefined;
    }

    openEdit(product: IProduct): void {
        this.editing = product;
        this.editingVersion = typeof product.version === 'number' ? product.version : 0;
    }

    close(): void {
        this.editing = null;
        this.editingVersion = undefined;
    }

    private async performSave(payload: InProduct, expectedVersion: number | undefined): Promise<boolean> {
        const result = await this.api.save(payload, expectedVersion);
        if (result.error) { notifyError(result.error); return false; }
        const requestedSlug = (payload.slug || '').trim();
        const finalSlug = (result.slug || '').trim();
        if (finalSlug && requestedSlug && finalSlug !== requestedSlug) {
            notifyWarning(
                this.t('Slug "{{requested}}" was already taken — saved as "{{final}}"', {requested: requestedSlug, final: finalSlug}),
            );
        } else {
            notifySuccess(payload.id ? this.t('Product updated') : this.t('Product created'));
        }
        this.close();
        await this.refresh();
        return true;
    }

    /** Caller passes form values + the parsed image-URL list. */
    async save(values: any): Promise<void> {
        const images = String(values.images ?? '').split('\n').map((s: string) => s.trim()).filter(Boolean);
        const payload: InProduct = {
            id: this.editing?.id,
            title: values.title,
            slug: values.slug,
            sku: values.sku,
            description: values.description,
            price: Number(values.price ?? 0),
            currency: values.currency,
            stock: Number(values.stock ?? 0),
            categories: values.categories ?? [],
            images,
            attributes: this.editing?.attributes ?? {},
            variants: this.editing?.variants ?? [],
            source: this.editing?.source ?? 'manual',
            externalId: this.editing?.externalId,
            manualOverrides: this.editing?.manualOverrides,
            draft: values.draft ?? false,
            // Phase 1.F polish — pipe through `templateId` from the
            // constrained picker. Empty string ⇒ clear, falls back to
            // `built-in:standard` at render time.
            templateId: typeof values.templateId === 'string' && values.templateId
                ? values.templateId
                : undefined,
        } as InProduct;
        this.saving = true;
        try {
            await this.performSave(payload, this.editingVersion);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performSave(payload, err.currentVersion);
                            this.conflict = null;
                        } finally { this.saving = false; }
                    },
                };
            } else {
                notifyError(err);
            }
        } finally {
            this.saving = false;
        }
    }

    async remove(product: IProduct): Promise<void> {
        const result = await this.api.remove(product.id);
        if (result.error) { notifyError(result.error); return; }
        // TODO: wire Undo — product delete routes through trash but the remove() API does not return a trashGroup yet.
        notifySuccess(this.t('Product deleted'));
        await this.refresh();
    }

    async togglePublish(product: IProduct): Promise<void> {
        const result = await this.api.setPublished(product.id, product.draft);
        if (result.error) { notifyError(result.error); return; }
        notifySuccess(result.draft ? this.t('Unpublished') : this.t('Published'));
        await this.refresh();
    }

    async takeTheirs(): Promise<void> {
        this.conflict = null;
        this.close();
        await this.refresh();
    }

    dismissConflict(): void { this.conflict = null; }
}
