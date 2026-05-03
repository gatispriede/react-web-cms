import {message} from 'antd';
import SiteSeoApi from '@services/api/client/SiteSeoApi';
import {DEFAULT_SITE_SEO, ISiteSeoDefaults} from '@interfaces/ISiteSeo';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

export interface SeoConflict {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

/** VM3 — SEO defaults pane (load / mutate / save with conflict handling). */
export class SEOViewModel {
    seo: ISiteSeoDefaults = {...DEFAULT_SITE_SEO};
    loading = false;
    saving  = false;
    conflict: SeoConflict | null = null;

    constructor(
        private readonly seoApi: SiteSeoApi = new SiteSeoApi(),
        private readonly t: (key: string) => string = (k) => k,
    ) {
        return observable(this);
    }

    update(patch: Partial<ISiteSeoDefaults>): void {
        this.seo = {...this.seo, ...patch};
    }

    dismissConflict(): void {
        this.conflict = null;
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try { this.seo = await this.seoApi.get(); }
        finally { this.loading = false; }
    }

    private async performSave(payload: ISiteSeoDefaults, expectedVersion: number | undefined): Promise<boolean> {
        const result = await this.seoApi.save(payload, expectedVersion);
        const errMsg = (result as {error?: string}).error;
        if (errMsg) { void message.error(errMsg); return false; }
        void message.success(this.t('SEO defaults saved'));
        const v = (result as {version?: number}).version;
        if (typeof v === 'number') this.seo = {...this.seo, version: v};
        return true;
    }

    async save(): Promise<void> {
        this.saving = true;
        try {
            await this.performSave(this.seo, this.seo.version);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performSave(this.seo, err.currentVersion);
                            this.conflict = null;
                        } finally { this.saving = false; }
                    },
                };
            } else {
                void message.error(String((err as Error)?.message ?? err));
            }
        } finally { this.saving = false; }
    }
}
