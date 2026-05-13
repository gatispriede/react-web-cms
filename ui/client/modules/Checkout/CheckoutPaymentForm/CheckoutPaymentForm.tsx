/** CheckoutPaymentForm — Phase 1.D. Locked card capture (PCI-safe iframe slot). */
import React, {useState} from 'react';
import type {IItem} from '@interfaces/IItem';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {OrderApi} from '@services/api/client/OrderApi';
import type {ICheckoutPaymentForm} from './CheckoutPaymentForm.types';
import './CheckoutPaymentForm.scss';

export interface CheckoutPaymentFormProps { item: IItem; }

function parseContent(raw: string | object | undefined): ICheckoutPaymentForm {
    if (!raw) return {} as ICheckoutPaymentForm;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICheckoutPaymentForm; } catch { return {} as ICheckoutPaymentForm; } }
    return raw as ICheckoutPaymentForm;
}

// Naive idempotency-key generator suitable for client-side authorize calls.
// Server enforces uniqueness; if the customer retries we want a new attempt.
const mkIdempotencyKey = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const CheckoutPaymentForm: React.FC<CheckoutPaymentFormProps> = ({item}) => {
    const c = parseContent(item.content);
    const {orderId, goTo} = useCheckoutMachine();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!orderId || busy) return;
        const fd = new FormData(e.currentTarget);
        const card = {
            number: String(fd.get('number') ?? '').replace(/\s+/g, ''),
            exp: String(fd.get('exp') ?? ''),
            cvc: String(fd.get('cvc') ?? ''),
        };
        if (!card.number || !card.exp || !card.cvc) {
            setError('Please fill all card fields.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const api = new OrderApi();
            const res = await api.authorizeOrderPayment({orderId, card, idempotencyKey: mkIdempotencyKey()});
            if ('error' in res) { setError(res.error); return; }
            if (!res.ok) { setError(res.declineCode ? `Card declined (${res.declineCode}).` : 'Card declined.'); return; }
            goTo('review');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form className="checkout-payment-form" data-testid="module-checkout-payment-form" onSubmit={onSubmit}>
            <h3>{c.title ?? 'Payment'}</h3>
            <input data-testid="payment-card-number" name="number" placeholder="Card number" maxLength={19} required />
            <input data-testid="payment-card-exp" name="exp" placeholder="MM/YY" maxLength={5} required />
            <input data-testid="payment-card-cvc" name="cvc" placeholder="CVC" maxLength={4} required />
            {error && <p className="checkout-payment-form__error" data-testid="payment-error">{error}</p>}
            <button type="submit" data-testid="payment-submit" disabled={busy || !orderId}>
                {busy ? 'Authorising…' : 'Authorise card'}
            </button>
        </form>
    );
};

export default CheckoutPaymentForm;
export {CheckoutPaymentForm};
export {ECheckoutPaymentFormStyle, type ICheckoutPaymentForm} from './CheckoutPaymentForm.types';
