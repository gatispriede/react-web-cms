import {notifyError, notifyPromise, notifySuccess} from '@admin/lib/notify';
import {observable} from '@client/lib/state/observable';
import {resolve} from '@services/api/generated';
import adminI18n from '@admin/i18n/adminI18n';

/**
 * Q7 — onboarding wizard view-model. Owns the 3-step state machine
 * (site name + locale, admin account, theme pick), validates each
 * step's payload locally, then fires `onboardingBootstrap` against
 * the GraphQL endpoint.
 *
 * No `useState` — VM3 convention. Components subscribe via
 * `useViewModel(() => new OnboardingViewModel())`.
 */

export interface OnboardingDraft {
    siteName: string;
    locale: string;
    adminEmail: string;
    adminPassword: string;
    adminPasswordConfirm: string;
    confirmFirstAdmin: boolean;
    themeKey: string;
}

const EMPTY: OnboardingDraft = {
    siteName: '',
    locale: 'en',
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    confirmFirstAdmin: false,
    themeKey: '',
};

export const PASSWORD_MIN_LENGTH = 12;

export class OnboardingViewModel {
    step = 0;
    draft: OnboardingDraft = {...EMPTY};
    submitting = false;
    error: string | null = null;
    done = false;
    seedSample = true;
    seeding = false;

    constructor(
        private readonly onComplete: () => void = () => {},
    ) {
        return observable(this);
    }

    set<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]): void {
        this.draft = {...this.draft, [key]: value};
    }

    canAdvance(): boolean {
        if (this.step === 0) {
            return Boolean(this.draft.siteName.trim() && this.draft.locale.trim());
        }
        if (this.step === 1) {
            const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.draft.adminEmail);
            const pwOk = this.draft.adminPassword.length >= PASSWORD_MIN_LENGTH;
            const matchOk = this.draft.adminPassword === this.draft.adminPasswordConfirm;
            return emailOk && pwOk && matchOk && this.draft.confirmFirstAdmin;
        }
        if (this.step === 2) {
            return Boolean(this.draft.themeKey);
        }
        return false;
    }

    next(): void {
        if (!this.canAdvance()) return;
        if (this.step < 2) this.step += 1;
    }

    back(): void {
        if (this.step > 0) this.step -= 1;
    }

    setSeedSample(value: boolean): void {
        this.seedSample = value;
    }

    /**
     * Imports the curated `seeds/admin-onboarding.bundle.json` so the
     * fresh admin lands on a non-blank surface. Calls the same
     * `/api/import` route the Bundle pane uses — idempotent stable ids
     * mean re-running upserts rather than duplicating.
     */
    async seedSampleBundle(): Promise<void> {
        if (this.seeding) return;
        this.seeding = true;
        try {
            await notifyPromise(
                (async () => {
                    const res = await fetch('/seeds/admin-onboarding.bundle.json');
                    if (!res.ok) throw new Error(`Seed fetch failed: ${res.status}`);
                    const bundle = await res.json();
                    const imp = await fetch('/api/import', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(bundle),
                    });
                    const data = await imp.json();
                    if (!imp.ok || data.error) {
                        throw new Error(data.error || `Import failed: ${imp.status}`);
                    }
                    return data;
                })(),
                {
                    loading: adminI18n.t('Seeding sample content…'),
                    success: adminI18n.t('Sample content imported'),
                    error: (err) => adminI18n.t('errors.generic', {message: String((err as Error)?.message ?? err)}),
                },
            );
        } catch (err) {
            // notifyPromise already surfaced the error toast; swallow so
            // the wizard can still complete with the bootstrap success.
            notifyError(err);
        } finally {
            this.seeding = false;
        }
    }

    async submit(): Promise<void> {
        if (!this.canAdvance() || this.submitting) return;
        this.submitting = true;
        this.error = null;
        try {
            const raw = await resolve(({mutation}) =>
                (mutation as any).mongo.onboardingBootstrap({
                    siteName: this.draft.siteName.trim(),
                    locale: this.draft.locale.trim(),
                    adminEmail: this.draft.adminEmail.trim().toLowerCase(),
                    adminPassword: this.draft.adminPassword,
                    themeKey: this.draft.themeKey,
                }),
            );
            const parsed = JSON.parse(raw || '{}');
            if (parsed.error) {
                this.error = String(parsed.error);
                notifyError(this.error);
                return;
            }
            this.done = true;
            if (this.seedSample) {
                await this.seedSampleBundle();
            }
            notifySuccess('Welcome — start by adding your first page.');
            this.onComplete();
        } catch (err) {
            this.error = String((err as Error).message ?? err);
            notifyError(this.error);
        } finally {
            this.submitting = false;
        }
    }
}
