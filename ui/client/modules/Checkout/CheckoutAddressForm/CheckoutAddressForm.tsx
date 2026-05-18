/** CheckoutAddressForm — Phase 1.D. Locked shipping address capture. */
import React, {useState} from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IOrderAddress} from '@interfaces/IOrder';
import {useCart} from '@client/features/Cart/useCart';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {OrderApi} from '@services/api/client/OrderApi';
import type {ICheckoutAddressForm} from './CheckoutAddressForm.types';

export interface CheckoutAddressFormProps { item: IItem; }

function parseContent(raw: string | object | undefined): ICheckoutAddressForm {
    if (!raw) return {} as ICheckoutAddressForm;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICheckoutAddressForm; } catch { return {} as ICheckoutAddressForm; } }
    return raw as ICheckoutAddressForm;
}

const CheckoutAddressForm: React.FC<CheckoutAddressFormProps> = ({item}) => {
    const c = parseContent(item.content);
    const {cart} = useCart();
    const {orderId, setOrderId, goTo} = useCheckoutMachine();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (busy) return;
        const fd = new FormData(e.currentTarget);
        const shipping: IOrderAddress = {
            name: String(fd.get('name') ?? '').trim(),
            line1: String(fd.get('line1') ?? '').trim(),
            city: String(fd.get('city') ?? '').trim(),
            region: String(fd.get('region') ?? '').trim(),
            postalCode: String(fd.get('postalCode') ?? '').trim(),
            country: String(fd.get('country') ?? '').trim().toUpperCase(),
        };
        if (!shipping.name || !shipping.line1 || !shipping.city || !shipping.postalCode || !shipping.country) {
            setError('Please fill all required fields.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const api = new OrderApi();
            let id = orderId;
            // Try the stored orderId first. If it points to an order
            // that's no longer pending (paid, fulfilled, cancelled, …)
            // the server rejects with `IMMUTABLE_ORDER`. Treat that as
            // "the saved draft is stale" — clear it and create a fresh
            // one. Same fallback if there's no orderId at all.
            const attachWithId = async (orderId: string) => {
                return api.attachOrderAddress({orderId, shipping});
            };
            const freshDraft = async (): Promise<string | null> => {
                const draft = await api.createDraftOrder({currency: cart.currency ?? 'EUR'});
                if ('error' in draft) { setError(draft.error); return null; }
                if (!draft.id) { setError('Could not create order.'); return null; }
                setOrderId(draft.id);
                return draft.id;
            };
            if (!id) {
                id = (await freshDraft()) ?? '';
                if (!id) return;
            }
            let res = await attachWithId(id);
            if ('error' in res && /IMMUTABLE_ORDER/i.test(res.error)) {
                // Stale draft — start over silently.
                const next = await freshDraft();
                if (!next) return;
                id = next;
                res = await attachWithId(id);
            }
            if ('error' in res) { setError(res.error); return; }
            goTo('shipping');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className={`checkout-address-form${item.style && item.style !== 'default' ? ` ${item.style as string}` : ''}`} data-testid="module-checkout-address-form" onSubmit={handleSubmit}>
            <h3>{c.title ?? 'Shipping address'}</h3>
            <input data-testid="address-form-name" name="name" placeholder="Full name" required />
            <input data-testid="address-form-line1" name="line1" placeholder="Address line 1" required />
            <input data-testid="address-form-line2" name="line2" placeholder="Address line 2 (optional)" />
            <input data-testid="address-form-city" name="city" placeholder="City" required />
            <input data-testid="address-form-region" name="region" placeholder="Region / State" />
            <input data-testid="address-form-postal" name="postalCode" placeholder="Postal code" required />
            <input data-testid="address-form-country" name="country" placeholder="Country (2-letter)" maxLength={2} required />
            {error && <p className="checkout-address-form__error" data-testid="address-form-error">{error}</p>}
            <button type="submit" data-testid="address-form-submit" disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
        </form>
    );
};

export default CheckoutAddressForm;
export {CheckoutAddressForm};
export {ECheckoutAddressFormStyle, type ICheckoutAddressForm} from './CheckoutAddressForm.types';
