/** CheckoutAddressForm — Phase 1.D. Locked shipping address capture. */
import React, {useState} from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IOrderAddress} from '@interfaces/IOrder';
import {useCart} from '@client/features/Cart/useCart';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {OrderApi} from '@services/api/client/OrderApi';
import type {ICheckoutAddressForm} from './CheckoutAddressForm.types';
import './CheckoutAddressForm.scss';

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
            if (!id) {
                const draft = await api.createDraftOrder({currency: cart.currency ?? 'EUR'});
                if ('error' in draft) { setError(draft.error); return; }
                id = draft.id;
                if (!id) { setError('Could not create order.'); return; }
                setOrderId(id);
            }
            const res = await api.attachOrderAddress({orderId: id, shipping});
            if ('error' in res) { setError(res.error); return; }
            goTo('shipping');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="checkout-address-form" data-testid="module-checkout-address-form" onSubmit={handleSubmit}>
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
