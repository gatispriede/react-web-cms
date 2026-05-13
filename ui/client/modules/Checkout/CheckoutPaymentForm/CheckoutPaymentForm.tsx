/** CheckoutPaymentForm — Phase 1.D. Locked card capture (PCI-safe iframe slot). */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {ICheckoutPaymentForm} from './CheckoutPaymentForm.types';
import './CheckoutPaymentForm.scss';

export interface CheckoutPaymentFormProps { item: IItem; }

function parseContent(raw: string | object | undefined): ICheckoutPaymentForm {
    if (!raw) return {} as ICheckoutPaymentForm;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICheckoutPaymentForm; } catch { return {} as ICheckoutPaymentForm; } }
    return raw as ICheckoutPaymentForm;
}

const CheckoutPaymentForm: React.FC<CheckoutPaymentFormProps> = ({item}) => {
    const c = parseContent(item.content);
    return (
        <form className="checkout-payment-form" data-testid="module-checkout-payment-form" onSubmit={e => e.preventDefault()}>
            <h3>{c.title ?? 'Payment'}</h3>
            <input data-testid="payment-card-number" name="number" placeholder="Card number" maxLength={19} />
            <input data-testid="payment-card-exp" name="exp" placeholder="MM/YY" maxLength={5} />
            <input data-testid="payment-card-cvc" name="cvc" placeholder="CVC" maxLength={4} />
        </form>
    );
};

export default CheckoutPaymentForm;
export {CheckoutPaymentForm};
export {ECheckoutPaymentFormStyle, type ICheckoutPaymentForm} from './CheckoutPaymentForm.types';
