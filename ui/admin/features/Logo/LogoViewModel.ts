import {notifyError, notifySuccess, notifyWarning} from '@admin/lib/notify';
import {ELogoStyle} from '@enums/ELogoStyle';
import {ELogoVariant} from '@enums/ELogoVariant';
import {ILogoContent, ILogoVariantAsset} from '@interfaces/ILogo';
import MongoApi from '@services/api/client/MongoApi';
import {PUBLIC_IMAGE_PATH} from '@utils/imgPath';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

export type LogoVariants = Partial<Record<ELogoVariant, ILogoVariantAsset>>;

export interface LogoState {
    src: string;
    width: number;
    height: number;
    style: ELogoStyle;
    /**
     * Multi-variant slots (logo-style-options). Each variant is independently
     * optional; the public renderer falls back through `Full` → legacy `src`
     * → built-in mark. See `shared/types/ILogo.ts#resolveLogoVariantSrc`.
     */
    variants: LogoVariants;
}

export const DEFAULT_LOGO: LogoState = {
    src: '',
    width: 40,
    height: 40,
    style: ELogoStyle.Default,
    variants: {},
};

export interface LogoConflict {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

/** VM3 — Logo settings admin pane state. */
export class LogoViewModel {
    logo: LogoState = {...DEFAULT_LOGO};
    version: number | undefined = undefined;
    saving = false;
    loading = false;
    audit: {editedBy?: string; editedAt?: string} = {};
    conflict: LogoConflict | null = null;

    constructor(
        private readonly api: MongoApi = new MongoApi(),
        private readonly t: (k: string) => string = (k) => k,
    ) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const raw = await this.api.getLogo();
            this.audit = {editedBy: raw?.editedBy, editedAt: raw?.editedAt};
            this.version = (raw as {version?: number})?.version;
            if (!raw?.content) { this.logo = {...DEFAULT_LOGO}; return; }
            try {
                const parsed = JSON.parse(raw.content) as Partial<ILogoContent>;
                const parsedStyle = typeof parsed?.style === 'string'
                    && (Object.values(ELogoStyle) as string[]).includes(parsed.style)
                    ? (parsed.style as ELogoStyle)
                    : DEFAULT_LOGO.style;
                // Sanitise variants: drop unknown keys + non-string srcs. This
                // is the back-compat seam — legacy rows have no `variants`
                // field and parse to an empty record, leaving `src` as the
                // sole asset (resolved as the `Full` variant by readers).
                const validVariantKeys = new Set<string>(Object.values(ELogoVariant) as string[]);
                const rawVariants = (parsed?.variants ?? {}) as Record<string, unknown>;
                const variants: LogoVariants = {};
                for (const [k, v] of Object.entries(rawVariants)) {
                    if (!validVariantKeys.has(k)) continue;
                    const entry = v as Partial<ILogoVariantAsset> | null | undefined;
                    if (entry && typeof entry.src === 'string' && entry.src) {
                        variants[k as ELogoVariant] = {
                            src: entry.src,
                            width: Number.isFinite(entry.width) ? entry.width as number : undefined,
                            height: Number.isFinite(entry.height) ? entry.height as number : undefined,
                        };
                    }
                }
                this.logo = {
                    src: typeof parsed?.src === 'string' ? parsed.src : '',
                    width: Number.isFinite(parsed?.width) ? parsed.width as number : DEFAULT_LOGO.width,
                    height: Number.isFinite(parsed?.height) ? parsed.height as number : DEFAULT_LOGO.height,
                    style: parsedStyle,
                    variants,
                };
            } catch { this.logo = {...DEFAULT_LOGO, variants: {}}; }
        } finally { this.loading = false; }
    }

    /** ImageUpload calls this with either a raw File or an IImage. */
    handleFile(f: any): void {
        const src = this.inferLocation(f);
        if (!src) {
            notifyWarning(this.t('Could not determine the uploaded image location yet — try again.'));
            return;
        }
        this.logo = {...this.logo, src};
    }

    setLogoSrc(src: string): void { this.logo = {...this.logo, src}; }
    setHeight(height: number): void { this.logo = {...this.logo, height}; }
    setStyle(style: ELogoStyle): void { this.logo = {...this.logo, style}; }

    /** Set or replace a per-variant asset slot. */
    setVariantSrc(variant: ELogoVariant, src: string): void {
        const next: LogoVariants = {...this.logo.variants};
        if (src) next[variant] = {...(next[variant] ?? {src: ''}), src};
        else delete next[variant];
        this.logo = {...this.logo, variants: next};
    }

    /** Drop a per-variant slot entirely. */
    clearVariant(variant: ELogoVariant): void {
        if (!this.logo.variants[variant]) return;
        const next: LogoVariants = {...this.logo.variants};
        delete next[variant];
        this.logo = {...this.logo, variants: next};
    }

    /** Variant-aware version of `handleFile` — infers src then writes the slot. */
    handleVariantFile(variant: ELogoVariant, f: any): void {
        const src = this.inferLocation(f);
        if (!src) {
            notifyWarning(this.t('Could not determine the uploaded image location yet — try again.'));
            return;
        }
        this.setVariantSrc(variant, src);
    }

    private inferLocation(f: any): string | undefined {
        if (!f) return undefined;
        if (typeof f.location === 'string' && f.location) return f.location;
        const name = typeof f.name === 'string' ? f.name : undefined;
        if (!name) return undefined;
        return `${PUBLIC_IMAGE_PATH}${name.replace(/ /g, '_')}`;
    }

    private async performSave(payload: LogoState, expectedVersion: number | undefined, okMessage: string): Promise<boolean> {
        const result = await this.api.saveLogo(JSON.stringify(payload), expectedVersion);
        if ((result as {error?: string}).error) { notifyError((result as {error?: string}).error ?? ''); return false; }
        if (typeof (result as {version?: number}).version === 'number') {
            this.version = (result as {version?: number}).version;
        }
        notifySuccess(okMessage);
        return true;
    }

    async save(): Promise<void> {
        this.saving = true;
        try {
            await this.performSave(this.logo, this.version, this.t('Logo saved'));
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performSave(this.logo, err.currentVersion, this.t('Logo saved'));
                            this.conflict = null;
                        } finally { this.saving = false; }
                    },
                };
            } else {
                notifyError(err);
            }
        } finally { this.saving = false; }
    }

    async clear(): Promise<void> {
        this.saving = true;
        try {
            await this.performSave({...DEFAULT_LOGO}, this.version, this.t('Logo cleared'));
            this.logo = {...DEFAULT_LOGO};
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performSave({...DEFAULT_LOGO}, err.currentVersion, this.t('Logo cleared'));
                            this.logo = {...DEFAULT_LOGO};
                            this.conflict = null;
                        } finally { this.saving = false; }
                    },
                };
            } else {
                notifyError(err);
            }
        } finally { this.saving = false; }
    }

    async takeTheirs(): Promise<void> { this.conflict = null; await this.refresh(); }
    dismissConflict(): void { this.conflict = null; }
}
