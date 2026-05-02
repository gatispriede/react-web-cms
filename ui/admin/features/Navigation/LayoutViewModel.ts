import {message} from 'antd';
import SiteFlagsApi from '@services/api/client/SiteFlagsApi';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

export interface LayoutConflict {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

interface SaveablePatch {
    layoutMode?: 'tabs' | 'scroll';
    inlineTranslationEdit?: boolean;
    autoHighContrast?: boolean;
    selfHostFonts?: boolean;
    inquiryEnabled?: boolean;
    inquiryRecipientEmail?: string;
    inquiryMaxPerClient?: number;
    inquiryAllowedOrigins?: string;
}

/** VM3 — Site Layout admin pane state. */
export class LayoutViewModel {
    mode: 'tabs' | 'scroll' = 'tabs';
    inlineEdit = false;
    autoHC = false;
    selfHostFonts = false;
    inquiryEnabled = true;
    inquiryEmail = '';
    inquiryEmailDirty = false;
    inquiryMax = 3;
    inquiryMaxDirty = false;
    inquiryOrigins = '';
    inquiryOriginsDirty = false;
    inquirySaving = false;
    version: number | undefined = undefined;
    loading = false;
    audit: {editedBy?: string; editedAt?: string} = {};
    conflict: LayoutConflict | null = null;

    constructor(
        private readonly api: SiteFlagsApi = new SiteFlagsApi(),
        private readonly t: (k: string) => string = (k) => k,
    ) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const flags = await this.api.get();
            this.mode = (flags as any).layoutMode === 'scroll' ? 'scroll' : 'tabs';
            this.inlineEdit = Boolean((flags as any).inlineTranslationEdit);
            this.autoHC = Boolean((flags as any).autoHighContrast);
            this.selfHostFonts = Boolean((flags as any).selfHostFonts);
            this.inquiryEnabled = (flags as any).inquiryEnabled !== false;
            this.inquiryEmail = String((flags as any).inquiryRecipientEmail ?? '');
            this.inquiryEmailDirty = false;
            this.inquiryMax = typeof (flags as any).inquiryMaxPerClient === 'number' ? (flags as any).inquiryMaxPerClient : 3;
            this.inquiryMaxDirty = false;
            this.inquiryOrigins = String((flags as any).inquiryAllowedOrigins ?? '');
            this.inquiryOriginsDirty = false;
            this.version = (flags as any).version;
            this.audit = {editedBy: (flags as any).editedBy, editedAt: (flags as any).editedAt};
        } finally { this.loading = false; }
    }

    private async performSave(patch: SaveablePatch, expectedVersion: number | undefined): Promise<boolean> {
        const result = await this.api.save(patch as any, expectedVersion);
        if ((result as {error?: string}).error) { message.error((result as {error?: string}).error ?? ''); return false; }
        message.success(this.t('Saved'));
        if (typeof (result as {version?: number}).version === 'number') {
            this.version = (result as {version?: number}).version;
        }
        return true;
    }

    /** Generic toggle helper — mutates a field, persists, rolls back on error. */
    private async toggleField<K extends keyof SaveablePatch>(
        field: K,
        next: SaveablePatch[K],
        prev: SaveablePatch[K],
        applyLocal: (v: SaveablePatch[K]) => void,
    ): Promise<void> {
        applyLocal(next);
        const patch: SaveablePatch = {[field]: next} as SaveablePatch;
        try {
            await this.performSave(patch, this.version);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        try {
                            await this.performSave(patch, err.currentVersion);
                            this.conflict = null;
                        } catch (e) { message.error(String((e as Error)?.message ?? e)); this.conflict = null; }
                    },
                };
            } else {
                applyLocal(prev);
                message.error(String((err as Error)?.message ?? err));
            }
        }
    }

    setMode(next: 'tabs' | 'scroll'): void {
        const prev = this.mode;
        void this.toggleField('layoutMode', next, prev, (v) => { this.mode = v as 'tabs' | 'scroll'; });
    }

    setInlineEdit(next: boolean): void {
        const prev = this.inlineEdit;
        void this.toggleField('inlineTranslationEdit', next, prev, (v) => { this.inlineEdit = !!v; });
    }

    setAutoHC(next: boolean): void {
        const prev = this.autoHC;
        void this.toggleField('autoHighContrast', next, prev, (v) => { this.autoHC = !!v; });
    }

    setSelfHostFonts(next: boolean): void {
        const prev = this.selfHostFonts;
        void this.toggleField('selfHostFonts', next, prev, (v) => { this.selfHostFonts = !!v; });
    }

    setInquiryEnabled(next: boolean): void {
        const prev = this.inquiryEnabled;
        void this.toggleField('inquiryEnabled', next, prev, (v) => { this.inquiryEnabled = !!v; });
    }

    setInquiryEmail(v: string): void { this.inquiryEmail = v; this.inquiryEmailDirty = true; }
    setInquiryMax(v: number): void { this.inquiryMax = v; this.inquiryMaxDirty = true; }
    setInquiryOrigins(v: string): void { this.inquiryOrigins = v; this.inquiryOriginsDirty = true; }

    async saveInquiryEmail(): Promise<void> {
        const candidate = this.inquiryEmail.trim();
        if (candidate && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
            message.error(this.t('Enter a valid email address (or leave empty to reset to default).'));
            return;
        }
        this.inquirySaving = true;
        try {
            await this.performSave({inquiryRecipientEmail: candidate}, this.version);
            this.inquiryEmailDirty = false;
            await this.refresh();
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        try {
                            await this.performSave({inquiryRecipientEmail: candidate}, err.currentVersion);
                            this.inquiryEmailDirty = false;
                            await this.refresh();
                            this.conflict = null;
                        } catch (e) { message.error(String((e as Error)?.message ?? e)); this.conflict = null; }
                    },
                };
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally { this.inquirySaving = false; }
    }

    async saveInquiryMax(): Promise<void> {
        const candidate = Math.max(0, Math.min(100, Math.floor(this.inquiryMax || 0)));
        this.inquirySaving = true;
        try {
            await this.performSave({inquiryMaxPerClient: candidate}, this.version);
            this.inquiryMaxDirty = false;
            await this.refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally { this.inquirySaving = false; }
    }

    async saveInquiryOrigins(): Promise<void> {
        this.inquirySaving = true;
        try {
            await this.performSave({inquiryAllowedOrigins: this.inquiryOrigins.trim()}, this.version);
            this.inquiryOriginsDirty = false;
            await this.refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally { this.inquirySaving = false; }
    }

    async takeTheirs(): Promise<void> { this.conflict = null; await this.refresh(); }
    dismissConflict(): void { this.conflict = null; }
}
