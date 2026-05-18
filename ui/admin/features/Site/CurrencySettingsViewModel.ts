/**
 * Polish bundle (W8g follow-up) — Currency settings VM.
 *
 * Per project policy (`feedback_coding_principles`) admin features use
 * `observable()` rather than React `useState`. notifyPromise for the
 * save round-trip so the operator sees loading + success/fail toast.
 */
import {observable} from '@client/lib/state/observable';
import {notifyPromise} from '@admin/lib/notify';
import {SiteFlagsApi} from '@services/api/client/SiteFlagsApi';
import {DEFAULT_SITE_FLAGS, type ISiteFlags} from '@services/features/Seo/SiteFlagsService';

export interface StripeEnvStatus {
    /** Whether `STRIPE_SECRET_KEY` is present in the running process. */
    present: boolean;
    mode?: 'test' | 'live' | 'unknown';
}

async function fetchStripeEnvStatus(): Promise<StripeEnvStatus> {
    try {
        const r = await fetch('/api/admin/site-status?view=stripe', {credentials: 'same-origin'});
        if (!r.ok) return {present: false};
        const j = await r.json();
        return {present: Boolean(j?.stripeKey?.present), mode: j?.stripeKey?.mode};
    } catch {
        return {present: false};
    }
}

export class CurrencySettingsViewModel {
    loading = true;
    saving = false;
    flags: ISiteFlags = DEFAULT_SITE_FLAGS;
    stripe: StripeEnvStatus = {present: false};
    err: string | null = null;

    constructor(private readonly t: (k: string, opts?: Record<string, unknown>) => string = (k) => k) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        this.err = null;
        try {
            const api = new SiteFlagsApi();
            const [f, s] = await Promise.all([api.get(), fetchStripeEnvStatus()]);
            this.flags = f;
            this.stripe = s;
        } catch (e) {
            this.err = (e as Error)?.message ?? 'Could not load currency settings';
        } finally {
            this.loading = false;
        }
    }

    setEnabledCurrencies(list: string[]): void {
        this.flags = {...this.flags, enabledCurrencies: list};
    }

    setDefaultCurrency(c: string): void {
        this.flags = {...this.flags, defaultCurrency: c};
    }

    setStripeTaxEnabled(v: boolean): void {
        this.flags = {...this.flags, stripeTaxEnabled: v};
    }

    async save(): Promise<void> {
        this.saving = true;
        this.err = null;
        try {
            const api = new SiteFlagsApi();
            await notifyPromise(
                api.save({
                    enabledCurrencies: this.flags.enabledCurrencies,
                    defaultCurrency: this.flags.defaultCurrency,
                    stripeTaxEnabled: this.flags.stripeTaxEnabled,
                }, this.flags.version ?? null).then((res) => {
                    if (res && (res as {error?: string}).error) {
                        throw new Error((res as {error: string}).error);
                    }
                    return res;
                }),
                {
                    loading: this.t('pricing.notify.saving', {defaultValue: 'Saving currency settings…'}),
                    success: () => this.t('pricing.notify.saveSuccess', {defaultValue: 'Currency settings saved'}),
                    error: (e) => this.t('pricing.notify.saveFailed', {
                        defaultValue: 'Save failed: {{msg}}',
                        msg: String((e as Error)?.message ?? e),
                    }),
                },
            );
            await this.refresh();
        } catch (e) {
            this.err = (e as Error)?.message ?? 'Save failed';
        } finally {
            this.saving = false;
        }
    }
}
