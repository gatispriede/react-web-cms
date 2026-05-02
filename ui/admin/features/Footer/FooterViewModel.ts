import {message} from 'antd';
import FooterApi from '@services/api/client/FooterApi';
import {DEFAULT_FOOTER, IFooterColumn, IFooterConfig, IFooterEntry} from '@interfaces/IFooter';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

/** VM3 — Footer pane migrated from inline `useState`. */
export interface FooterConflictState {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

export class FooterViewModel {
    config: IFooterConfig = {...DEFAULT_FOOTER};
    loading = false;
    saving = false;
    conflict: FooterConflictState | null = null;

    constructor(
        private readonly api: FooterApi = new FooterApi(),
        private readonly t: (key: string, opts?: Record<string, unknown>) => string = (k) => k,
    ) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try { this.config = await this.api.get(); }
        finally { this.loading = false; }
    }

    update(patch: Partial<IFooterConfig>): void {
        this.config = {...this.config, ...patch};
    }

    setEnabled(enabled: boolean): void {
        this.update({enabled});
    }

    setBottom(bottom: string): void {
        this.update({bottom});
    }

    addColumn(): void {
        this.update({columns: [...this.config.columns, {title: this.t('New column'), entries: []}]});
    }

    removeColumn(i: number): void {
        this.update({columns: this.config.columns.filter((_, j) => j !== i)});
    }

    patchColumn(i: number, patch: Partial<IFooterColumn>): void {
        this.update({columns: this.config.columns.map((c, j) => j === i ? {...c, ...patch} : c)});
    }

    addEntry(i: number): void {
        this.patchColumn(i, {entries: [...this.config.columns[i].entries, {label: '', url: ''}]});
    }

    removeEntry(i: number, j: number): void {
        this.patchColumn(i, {entries: this.config.columns[i].entries.filter((_, k) => k !== j)});
    }

    patchEntry(i: number, j: number, patch: Partial<IFooterEntry>): void {
        this.patchColumn(i, {entries: this.config.columns[i].entries.map((e, k) => k === j ? {...e, ...patch} : e)});
    }

    private async performSave(cfg: IFooterConfig, expectedVersion: number | undefined): Promise<boolean> {
        const result = await this.api.save(cfg, expectedVersion);
        if ((result as {error?: string}).error) {
            message.error((result as {error?: string}).error ?? '');
            return false;
        }
        message.success(this.t('Footer saved'));
        if (typeof (result as {version?: number}).version === 'number') {
            this.config = {...this.config, version: (result as {version?: number}).version};
        }
        return true;
    }

    async save(): Promise<void> {
        this.saving = true;
        try {
            await this.performSave(this.config, this.config.version);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performSave(this.config, err.currentVersion);
                            this.conflict = null;
                        } finally { this.saving = false; }
                    },
                };
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally { this.saving = false; }
    }

    async takeTheirs(): Promise<void> {
        this.conflict = null;
        await this.refresh();
    }

    dismissConflict(): void { this.conflict = null; }
}
