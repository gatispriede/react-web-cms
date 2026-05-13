import {notifyError, notifySuccess} from '@admin/lib/notify';
import SiteFlagsApi from '@services/api/client/SiteFlagsApi';
import {observable} from '@client/lib/state/observable';

/**
 * Commerce settings VM — VM4 (no `useState` in the admin feature).
 *
 * Round-trips the `commerce.*` sub-record through the existing
 * `saveSiteFlags` resolver. The master toggle (`checkoutEnabled`)
 * lives here; per-payment-provider sub-toggles + checkout flow shape
 * land in sub-jump C.
 */
export interface ICommerceState {
    checkoutEnabled: boolean;
}

const DEFAULT_STATE: ICommerceState = {checkoutEnabled: false};

export class CommerceViewModel {
    state: ICommerceState = {...DEFAULT_STATE};
    version: number | undefined = undefined;
    loading = false;
    saving = false;
    audit: {editedBy?: string; editedAt?: string} = {};

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
            this.version = (flags as {version?: number})?.version;
            this.audit = {editedBy: (flags as any)?.editedBy, editedAt: (flags as any)?.editedAt};
            const commerce = ((flags as any)?.commerce ?? {}) as Record<string, unknown>;
            this.state = {
                checkoutEnabled: commerce.checkoutEnabled === true,
            };
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    setCheckoutEnabled(v: boolean): void {
        this.state = {...this.state, checkoutEnabled: v};
    }

    async save(): Promise<void> {
        this.saving = true;
        try {
            const next = await this.api.save(
                {commerce: {checkoutEnabled: this.state.checkoutEnabled}},
                this.version,
            );
            if ((next as {error?: string})?.error) {
                notifyError((next as {error?: string}).error ?? '');
                return;
            }
            if (typeof (next as {version?: number})?.version === 'number') {
                this.version = (next as {version?: number}).version;
            }
            notifySuccess(this.t('Commerce settings saved'));
        } catch (err) {
            notifyError(err);
        } finally {
            this.saving = false;
        }
    }
}
