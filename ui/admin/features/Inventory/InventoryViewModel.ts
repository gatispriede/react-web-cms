import {message} from 'antd';
import InventoryApi from '@services/api/client/InventoryApi';
import ProductApi from '@services/api/client/ProductApi';
import type {IProduct, InProduct} from '@interfaces/IProduct';
import type {
    IAdapterConfig,
    IInventoryDeadLetter,
    IInventoryRun,
    InventoryStatus,
    SyncReport,
} from '@interfaces/IInventory';
import {observable} from '@client/lib/state/observable';

const DEFAULT_FIELD_MAP = JSON.stringify({
    externalId: 'id',
    sku: 'sku',
    title: 'title',
    priceCents: 'priceCents',
    currency: 'currency',
    stock: 'stock',
    updatedAt: 'updatedAt',
}, null, 2);

/** VM3 — Inventory admin pane state. */
export class InventoryViewModel {
    status: InventoryStatus | null = null;
    loadingStatus = false;
    syncing: 'all' | 'delta' | null = null;
    lastReport: SyncReport | null = null;
    errorDrawer: IInventoryRun | null = null;
    deadOpen = false;
    deadRows: IInventoryDeadLetter[] = [];

    // Config form fields.
    kind: IAdapterConfig['kind'] = 'mock';
    feedUrl = '';
    authMode: 'none' | 'bearer' | 'apiKey' | 'basic' = 'none';
    credential = '';
    itemsPath = '';
    paginationJson = '{"kind":"none"}';
    fieldMapJson = DEFAULT_FIELD_MAP;
    savingCfg = false;

    // Per-product stock editor state.
    products: IProduct[] = [];
    loadingProducts = false;
    pendingSaves: Set<string> = new Set();
    stockDrafts: Record<string, number> = {};
    lastSavedSlug: string | null = null;

    constructor(
        private readonly api: InventoryApi = new InventoryApi(),
        private readonly t: (k: string) => string = (k) => k,
        private readonly productApi: ProductApi = new ProductApi(),
    ) {
        return observable(this);
    }

    isPendingSave(slug: string): boolean { return this.pendingSaves.has(slug); }

    setStockDraft(slug: string, qty: number): void {
        this.stockDrafts = {...this.stockDrafts, [slug]: qty};
    }

    async refreshProducts(): Promise<void> {
        this.loadingProducts = true;
        try {
            this.products = await this.productApi.list({includeDrafts: true, limit: 200});
            const drafts: Record<string, number> = {};
            for (const p of this.products) drafts[p.slug] = typeof p.stock === 'number' ? p.stock : 0;
            this.stockDrafts = drafts;
        } finally {
            this.loadingProducts = false;
        }
    }

    async saveProductStock(slug: string, qty: number): Promise<void> {
        const product = this.products.find(p => p.slug === slug);
        if (!product) { message.error(this.t('Product not found')); return; }
        const next = new Set(this.pendingSaves);
        next.add(slug);
        this.pendingSaves = next;
        try {
            const payload: InProduct = {
                id: product.id,
                title: product.title,
                slug: product.slug,
                sku: product.sku,
                description: product.description,
                price: product.price,
                currency: product.currency,
                stock: Math.max(0, Math.floor(qty)),
                categories: product.categories ?? [],
                images: product.images ?? [],
                attributes: product.attributes ?? {},
                variants: product.variants ?? [],
                source: product.source ?? 'manual',
                externalId: product.externalId,
                manualOverrides: product.manualOverrides,
                draft: product.draft ?? false,
            };
            const result = await this.productApi.save(payload, typeof product.version === 'number' ? product.version : undefined);
            if (result.error) { message.error(result.error); return; }
            message.success(this.t('Stock updated'));
            this.lastSavedSlug = slug;
            await this.refreshProducts();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            const after = new Set(this.pendingSaves);
            after.delete(slug);
            this.pendingSaves = after;
        }
    }

    setKind(k: IAdapterConfig['kind']): void { this.kind = k; }
    setFeedUrl(v: string): void { this.feedUrl = v; }
    setAuthMode(v: 'none' | 'bearer' | 'apiKey' | 'basic'): void { this.authMode = v; }
    setCredential(v: string): void { this.credential = v; }
    setItemsPath(v: string): void { this.itemsPath = v; }
    setPaginationJson(v: string): void { this.paginationJson = v; }
    setFieldMapJson(v: string): void { this.fieldMapJson = v; }
    setErrorDrawer(r: IInventoryRun | null): void { this.errorDrawer = r; }
    setDeadOpen(o: boolean): void { this.deadOpen = o; }

    async refreshStatus(): Promise<void> {
        this.loadingStatus = true;
        try {
            const s = await this.api.status();
            if ((s as {error?: string}).error) {
                message.error((s as {error: string}).error);
                return;
            }
            this.status = s as InventoryStatus;
        } finally {
            this.loadingStatus = false;
        }
    }

    async refreshDead(): Promise<void> {
        this.deadRows = await this.api.readDeadLetters(100);
    }

    async runSync(kind: 'all' | 'delta'): Promise<void> {
        this.syncing = kind;
        try {
            const out = kind === 'all' ? await this.api.syncAll() : await this.api.syncDelta();
            if ((out as {error?: string}).error) {
                message.error((out as {error: string}).error);
                return;
            }
            this.lastReport = out as SyncReport;
            const s = out as SyncReport;
            const summary = `${this.t('Sync')} ${kind === 'all' ? this.t('all') : this.t('delta')}: ${s.itemsCreated} ${this.t('created')}, ${s.itemsUpdated} ${this.t('updated')}, ${s.itemsArchived} ${this.t('archived')}, ${s.errors.length} ${this.t('errors')}`;
            if (s.status === 'succeeded') message.success(summary);
            else if (s.status === 'partial') message.warning(summary);
            else message.error(summary);
            await this.refreshStatus();
        } finally {
            this.syncing = null;
        }
    }

    async saveConfig(): Promise<void> {
        let pagination: unknown;
        let fieldMap: unknown;
        try { pagination = JSON.parse(this.paginationJson); }
        catch { message.error(this.t('Pagination JSON is invalid')); return; }
        try { fieldMap = JSON.parse(this.fieldMapJson); }
        catch { message.error(this.t('Field map JSON is invalid')); return; }
        const cfg: IAdapterConfig = this.kind === 'mock'
            ? {kind: 'mock'}
            : {
                kind: 'generic-feed',
                url: this.feedUrl,
                ...(this.authMode !== 'none' ? {authMode: this.authMode} : {}),
                ...(this.credential ? {credential: this.credential} : {}),
                ...(this.itemsPath ? {itemsPath: this.itemsPath} : {}),
                pagination: pagination as any,
                fieldMap: fieldMap as any,
            };
        this.savingCfg = true;
        try {
            const out = await this.api.saveAdapterConfig(cfg);
            if (out.error) { message.error(out.error); return; }
            message.success(this.t('Adapter config saved'));
            this.credential = '';
            await this.refreshStatus();
        } finally {
            this.savingCfg = false;
        }
    }

    async openDeadLetters(): Promise<void> {
        await this.refreshDead();
        this.deadOpen = true;
    }

    get runs(): IInventoryRun[] {
        const out: IInventoryRun[] = [];
        if (this.status?.currentRun) out.push(this.status.currentRun);
        if (this.status?.lastSuccessfulRun && this.status.lastSuccessfulRun.id !== this.status?.currentRun?.id) {
            out.push(this.status.lastSuccessfulRun);
        }
        return out;
    }

    get isRunning(): boolean {
        return !!this.status?.currentRun && this.status.currentRun.status === 'running';
    }
}
