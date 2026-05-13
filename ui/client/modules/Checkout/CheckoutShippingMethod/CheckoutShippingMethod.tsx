/** CheckoutShippingMethod — Phase 1.D. Locked carrier + service-level picker. */
import React, {useEffect, useState} from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IOrderShippingMethod} from '@interfaces/IOrder';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {formatMoney} from '@client/lib/checkout/api';
import {OrderApi} from '@services/api/client/OrderApi';
import type {ICheckoutShippingMethod} from './CheckoutShippingMethod.types';
import './CheckoutShippingMethod.scss';

export interface CheckoutShippingMethodProps { item: IItem; }

function parseContent(raw: string | object | undefined): ICheckoutShippingMethod {
    if (!raw) return {} as ICheckoutShippingMethod;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICheckoutShippingMethod; } catch { return {} as ICheckoutShippingMethod; } }
    return raw as ICheckoutShippingMethod;
}

const CheckoutShippingMethod: React.FC<CheckoutShippingMethodProps> = ({item}) => {
    const c = parseContent(item.content);
    const {orderId, goTo} = useCheckoutMachine();
    const [methods, setMethods] = useState<IOrderShippingMethod[]>([]);
    const [selected, setSelected] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) return;
        const api = new OrderApi();
        let cancelled = false;
        void api.shippingMethodsFor(orderId).then(list => {
            if (cancelled) return;
            setMethods(list);
            if (list.length > 0) setSelected(list[0].code);
        });
        return () => { cancelled = true; };
    }, [orderId]);

    const onContinue = async () => {
        if (!orderId || !selected || busy) return;
        setBusy(true);
        setError(null);
        try {
            const api = new OrderApi();
            const res = await api.attachOrderShipping({orderId, methodCode: selected});
            if ('error' in res) { setError(res.error); return; }
            goTo('payment');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="checkout-shipping-method" data-testid="module-checkout-shipping-method">
            <h3>{c.title ?? 'Shipping method'}</h3>
            {methods.length === 0 ? (
                <p data-testid="shipping-empty">No shipping methods available for this address.</p>
            ) : methods.map(m => (
                <label key={m.code} data-testid={`shipping-option-${m.code}`}>
                    <input
                        type="radio"
                        name="ship"
                        value={m.code}
                        checked={selected === m.code}
                        onChange={() => setSelected(m.code)}
                    />
                    {' '}{m.label} ({m.etaDays}d) — {formatMoney(m.price, null)}
                </label>
            ))}
            {error && <p className="checkout-shipping-method__error" data-testid="shipping-error">{error}</p>}
            <button type="button" data-testid="shipping-continue" onClick={onContinue} disabled={busy || !selected}>
                {busy ? 'Saving…' : 'Continue'}
            </button>
        </div>
    );
};

export default CheckoutShippingMethod;
export {CheckoutShippingMethod};
export {ECheckoutShippingMethodStyle, type ICheckoutShippingMethod} from './CheckoutShippingMethod.types';
