/**
 * Phase 1.B-c — checkout customization admin VM (VM4).
 *
 * MCP-routed reads/writes — no `useState` (per VM4 policy). Round-trips
 * the full `commerce.checkout.*` flag block + the shipping-method list
 * through:
 *   - `checkout.config.get` / `checkout.config.set`
 *   - `checkout.shipping.{list,create,update,delete,reorder}`
 *
 * The pane consumes:
 *   - `state.flow` (single-step | multi-step)
 *   - `state.requireAccount` (bool)
 *   - `state.fields` (per-customer-type × per-field state)
 *   - `state.orderSummaryTemplate` (compact | detailed)
 *   - `state.postPurchaseRedirect` (order-confirmation | …)
 *   - `state.providers` ({stripe, bankTransfer, cashOnDelivery, paypal, klarna})
 *   - `state.shippingMethods` (IShippingMethod[])
 */
import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';
import type {IShippingMethod} from '@interfaces/IShippingMethod';
import type {ICheckoutFieldsConfig} from '@services/features/Commerce/commerceFlags';

export type CheckoutFlow = 'single-step' | 'multi-step';
export type OrderSummaryTemplate = 'compact' | 'detailed';
export type PostPurchaseRedirect = 'order-confirmation' | 'custom-thank-you' | 'magic-link-signup';
export type FieldState = 'required' | 'optional' | 'hidden';
export type CustomerKind = 'client' | 'company';
export type FieldKey = 'phone' | 'company' | 'vatId' | 'shippingNotes';

const DEFAULT_FIELDS: ICheckoutFieldsConfig = {
    client: {phone: 'optional', company: 'hidden', vatId: 'hidden', shippingNotes: 'optional'},
    company: {phone: 'required', company: 'required', vatId: 'optional', shippingNotes: 'optional'},
};

async function mcp<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name, arguments: args}),
    });
    if (!res.ok) throw new Error(`MCP ${name} failed: ${res.status}`);
    const env = await res.json();
    const text = env?.content?.[0]?.text ?? JSON.stringify(env);
    const parsed = JSON.parse(text);
    if (parsed?.ok === false) throw new Error(parsed?.error?.message || parsed?.error || 'MCP error');
    return (parsed?.data ?? parsed) as T;
}

export interface CheckoutCustomizationState {
    flow: CheckoutFlow;
    requireAccount: boolean;
    fields: ICheckoutFieldsConfig;
    orderSummaryTemplate: OrderSummaryTemplate;
    postPurchaseRedirect: PostPurchaseRedirect;
    providers: {stripe: boolean; bankTransfer: boolean; cashOnDelivery: boolean; paypal: boolean; klarna: boolean};
}

const DEFAULT_STATE: CheckoutCustomizationState = {
    flow: 'single-step',
    requireAccount: false,
    fields: DEFAULT_FIELDS,
    orderSummaryTemplate: 'detailed',
    postPurchaseRedirect: 'magic-link-signup',
    providers: {stripe: true, bankTransfer: true, cashOnDelivery: true, paypal: false, klarna: false},
};

export class CheckoutCustomizationViewModel {
    state: CheckoutCustomizationState = {...DEFAULT_STATE};
    shippingMethods: IShippingMethod[] = [];
    loading = false;
    error: string | null = null;

    constructor() { return observable(this); }

    async refresh(): Promise<void> {
        this.loading = true;
        this.error = null;
        try {
            const [cfg, ship] = await Promise.all([
                mcp<{checkout?: Record<string, unknown>}>('checkout.config.get', {}),
                mcp<{rows?: IShippingMethod[]}>('checkout.shipping.list', {}),
            ]);
            const c = (cfg.checkout ?? {}) as Record<string, unknown>;
            const providers = ((c.providers as Record<string, boolean>) ?? {});
            this.state = {
                flow: (c.flow as CheckoutFlow) ?? 'single-step',
                requireAccount: c.requireAccount === true,
                fields: (c.fields as ICheckoutFieldsConfig) ?? DEFAULT_FIELDS,
                orderSummaryTemplate: (c.orderSummaryTemplate as OrderSummaryTemplate) ?? 'detailed',
                postPurchaseRedirect: (c.postPurchaseRedirect as PostPurchaseRedirect) ?? 'magic-link-signup',
                providers: {
                    stripe: providers.stripe !== false,
                    bankTransfer: providers.bankTransfer !== false,
                    cashOnDelivery: providers.cashOnDelivery !== false,
                    paypal: providers.paypal === true,
                    klarna: providers.klarna === true,
                },
            };
            this.shippingMethods = ship.rows ?? [];
        } catch (err) {
            this.error = (err as Error).message;
            notifyError(`Failed to load: ${this.error}`);
        } finally {
            this.loading = false;
        }
    }

    private async setFlag<T>(path: string, value: T, optimistic: () => void): Promise<void> {
        optimistic();
        await notifyPromise(
            mcp('checkout.config.set', {path, value}),
            {loading: 'Saving…', success: () => 'Saved', error: (e: unknown) => `Save failed: ${(e as Error).message}`},
        );
    }

    setFlow(v: CheckoutFlow): Promise<void> {
        return this.setFlag('commerce.checkout.flow', v, () => { this.state = {...this.state, flow: v}; });
    }
    setRequireAccount(v: boolean): Promise<void> {
        return this.setFlag('commerce.checkout.requireAccount', v, () => { this.state = {...this.state, requireAccount: v}; });
    }
    setOrderSummaryTemplate(v: OrderSummaryTemplate): Promise<void> {
        return this.setFlag('commerce.checkout.orderSummaryTemplate', v, () => { this.state = {...this.state, orderSummaryTemplate: v}; });
    }
    setPostPurchaseRedirect(v: PostPurchaseRedirect): Promise<void> {
        return this.setFlag('commerce.checkout.postPurchaseRedirect', v, () => { this.state = {...this.state, postPurchaseRedirect: v}; });
    }
    setProvider(id: keyof CheckoutCustomizationState['providers'], on: boolean): Promise<void> {
        return this.setFlag(`commerce.checkout.providers.${id}`, on, () => {
            this.state = {...this.state, providers: {...this.state.providers, [id]: on}};
        });
    }
    setFieldState(kind: CustomerKind, field: FieldKey, value: FieldState): Promise<void> {
        const nextFields: ICheckoutFieldsConfig = {
            ...this.state.fields,
            [kind]: {...this.state.fields[kind], [field]: value},
        };
        return this.setFlag('commerce.checkout.fields', nextFields, () => {
            this.state = {...this.state, fields: nextFields};
        });
    }

    async createShippingMethod(name: string): Promise<void> {
        if (!name?.trim()) return;
        await notifyPromise(
            mcp('checkout.shipping.create', {
                method: {name: name.trim(), type: 'flat-rate', isActive: true, flatRate: {amount: 0, currency: 'EUR'}},
            }),
            {loading: 'Creating…', success: () => 'Created', error: (e: unknown) => `Create failed: ${(e as Error).message}`},
        );
        await this.refresh();
    }

    async updateShippingMethod(id: string, patch: Partial<IShippingMethod>): Promise<void> {
        await notifyPromise(
            mcp('checkout.shipping.update', {id, patch}),
            {loading: 'Saving…', success: () => 'Saved', error: (e: unknown) => `Save failed: ${(e as Error).message}`},
        );
        await this.refresh();
    }

    async deleteShippingMethod(id: string): Promise<void> {
        await notifyPromise(
            mcp('checkout.shipping.delete', {id}),
            {loading: 'Deleting…', success: () => 'Deleted', error: (e: unknown) => `Delete failed: ${(e as Error).message}`},
        );
        await this.refresh();
    }

    async reorderShippingMethods(orderedIds: string[]): Promise<void> {
        await notifyPromise(
            mcp('checkout.shipping.reorder', {orderedIds}),
            {loading: 'Reordering…', success: () => 'Saved', error: (e: unknown) => `Reorder failed: ${(e as Error).message}`},
        );
        await this.refresh();
    }
}
