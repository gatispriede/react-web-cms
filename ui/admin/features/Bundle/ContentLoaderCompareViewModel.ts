import {notifyError} from '@admin/lib/notify';
import TranslationManager from '@admin/shell/TranslationManager';
import TranslationMetaApi from '@services/api/client/TranslationMetaApi';
import {ITranslationMetaEntry, ITranslationMetaMap} from '@services/features/Languages/TranslationMetaService';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

/**
 * VM3 — ContentLoaderCompare (read-only side-by-side translations grid).
 *
 * Holds load state, filters, the locale resources, and translator-meta CRUD.
 * The Suspense `dataPromise` is awaited inside `loadAll()` so the call site
 * stays a thin React leaf.
 */

export interface LanguageEntry {
    symbol: string;
    label: string;
    default?: boolean;
}

export interface MetaConflict {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

const fetchLocale = async (lang: string): Promise<Record<string, string>> => {
    try {
        const r = await fetch(`/locales/${lang}/app.json`);
        if (!r.ok) return {};
        return await r.json();
    } catch {
        return {};
    }
};

export class ContentLoaderCompareViewModel {
    sourceMap:   Record<string, string> = {};
    langs:       LanguageEntry[] = [];
    resources:   Record<string, Record<string, string>> = {};
    filter       = '';
    missingOnly  = false;
    loading      = true;
    importOpen   = false;
    meta:        ITranslationMetaMap = {};
    metaVersion  = 0;
    conflict:    MetaConflict | null = null;

    constructor(
        private readonly translationManager: TranslationManager,
        private readonly dataPromise: Promise<unknown>,
        private readonly metaApi: TranslationMetaApi = new TranslationMetaApi(),
    ) {
        return observable(this);
    }

    setFilter(v: string): void { this.filter = v; }
    setMissingOnly(v: boolean): void { this.missingOnly = v; }
    openImport(): void { this.importOpen = true; }
    closeImport(): void { this.importOpen = false; }
    dismissConflict(): void { this.conflict = null; }

    async loadAll(): Promise<void> {
        this.loading = true;
        try {
            await this.dataPromise;
            this.sourceMap = {...this.translationManager.getTranslations()};
            const raw = await this.translationManager.getLanguages() as unknown;
            const list: LanguageEntry[] = Array.isArray(raw)
                ? (raw as LanguageEntry[])
                : Object.values((raw ?? {}) as Record<string, LanguageEntry>);
            this.langs = list;
            const loaded: Record<string, Record<string, string>> = {};
            await Promise.all(list.map(async l => {
                loaded[l.symbol] = await fetchLocale(l.symbol);
            }));
            this.resources = loaded;
            const current = await this.metaApi.get();
            this.meta = current.value;
            this.metaVersion = current.version;
        } finally {
            this.loading = false;
        }
    }

    async reloadMeta(): Promise<void> {
        const current = await this.metaApi.get();
        this.meta = current.value;
        this.metaVersion = current.version;
    }

    private async performMetaSave(patch: ITranslationMetaMap, expectedVersion: number | undefined): Promise<boolean> {
        const result = await this.metaApi.save(patch, expectedVersion);
        const errMsg = (result as {error?: string})?.error;
        if (errMsg) { notifyError(String(errMsg)); await this.reloadMeta(); return false; }
        const v = (result as {version?: number}).version;
        if (typeof v === 'number') this.metaVersion = v;
        const value = (result as {value?: ITranslationMetaMap}).value;
        if (value) this.meta = value;
        return true;
    }

    async persistMeta(key: string, entry: ITranslationMetaEntry): Promise<void> {
        // Optimistic update.
        const next = {...this.meta};
        const description = entry.description?.trim() ?? '';
        const context     = entry.context?.trim() ?? '';
        if (!description && !context) delete next[key];
        else next[key] = {
            ...(description ? {description} : {}),
            ...(context ? {context} : {}),
        };
        this.meta = next;

        const patch = {[key]: entry};
        try {
            await this.performMetaSave(patch, this.metaVersion);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        try {
                            await this.performMetaSave(patch, err.currentVersion);
                            this.conflict = null;
                        } catch (e) {
                            notifyError(e);
                            this.conflict = null;
                        }
                    },
                };
            } else {
                notifyError(err);
                await this.reloadMeta();
            }
        }
    }
}

/** Per-row inline-editor VM for translator notes. */
export class MetaCellViewModel {
    open        = false;
    description = '';
    context     = '';

    constructor() { return observable(this); }

    setOpen(v: boolean): void { this.open = v; }
    setDescription(v: string): void { this.description = v; }
    setContext(v: string): void { this.context = v; }

    syncFromEntry(entry: {description?: string; context?: string} | undefined): void {
        this.description = entry?.description ?? '';
        this.context     = entry?.context ?? '';
    }
}
