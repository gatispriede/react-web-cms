/** CheckoutCartSummary — Phase 1.D. Locked read-only mini cart on each step. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {ICheckoutCartSummary} from './CheckoutCartSummary.types';
import './CheckoutCartSummary.scss';
export interface CheckoutCartSummaryProps { item: IItem; }
function parseContent(raw: string|object|undefined): ICheckoutCartSummary {
    if (!raw) return {} as ICheckoutCartSummary;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICheckoutCartSummary; } catch { return {} as ICheckoutCartSummary; } }
    return raw as ICheckoutCartSummary;
}
const CheckoutCartSummary: React.FC<CheckoutCartSummaryProps> = ({item}) => {
    const c = parseContent(item.content);
    return (
        <aside className="checkout-cart-summary" data-testid="module-checkout-cart-summary">
            <h3>{c.title ?? 'Your order'}</h3>
            <ul className="checkout-cart-summary__lines" data-testid="checkout-cart-summary-lines" />
            <div className="checkout-cart-summary__total" data-testid="checkout-cart-summary-total">Total: —</div>
        </aside>
    );
};
export default CheckoutCartSummary;
export {CheckoutCartSummary};
export {ECheckoutCartSummaryStyle, type ICheckoutCartSummary} from './CheckoutCartSummary.types';
