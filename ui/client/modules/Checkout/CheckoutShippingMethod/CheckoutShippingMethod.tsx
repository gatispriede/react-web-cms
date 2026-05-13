/** CheckoutShippingMethod — Phase 1.D. Locked carrier + service-level picker. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
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
    return (
        <div className="checkout-shipping-method" data-testid="module-checkout-shipping-method">
            <h3>{c.title ?? 'Shipping method'}</h3>
            <label data-testid="shipping-option-standard"><input type="radio" name="ship" defaultChecked /> Standard (3-5 days)</label>
            <label data-testid="shipping-option-express"><input type="radio" name="ship" /> Express (1-2 days)</label>
        </div>
    );
};

export default CheckoutShippingMethod;
export {CheckoutShippingMethod};
export {ECheckoutShippingMethodStyle, type ICheckoutShippingMethod} from './CheckoutShippingMethod.types';
