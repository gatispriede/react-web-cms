/** CheckoutAddressForm — Phase 1.D. Locked shipping address capture. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
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
    return (
        <form className="checkout-address-form" data-testid="module-checkout-address-form" onSubmit={e => e.preventDefault()}>
            <h3>{c.title ?? 'Shipping address'}</h3>
            <input data-testid="address-form-name" name="name" placeholder="Full name" />
            <input data-testid="address-form-line1" name="line1" placeholder="Address line 1" />
            <input data-testid="address-form-city" name="city" placeholder="City" />
            <input data-testid="address-form-postal" name="postalCode" placeholder="Postal code" />
            <input data-testid="address-form-country" name="country" placeholder="Country (2-letter)" maxLength={2} />
            <button type="submit" data-testid="address-form-submit">Continue</button>
        </form>
    );
};

export default CheckoutAddressForm;
export {CheckoutAddressForm};
export {ECheckoutAddressFormStyle, type ICheckoutAddressForm} from './CheckoutAddressForm.types';
