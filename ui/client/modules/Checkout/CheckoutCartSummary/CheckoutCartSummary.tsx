/** CheckoutCartSummary — Phase 1.D. Locked read-only mini cart on each step. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import {useCart} from '@client/features/Cart/useCart';
import {formatMoney} from '@client/lib/checkout/api';
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
    const {cart} = useCart();
    return (
        <aside className="checkout-cart-summary" data-testid="module-checkout-cart-summary">
            <h3>{c.title ?? 'Your order'}</h3>
            <ul className="checkout-cart-summary__lines" data-testid="checkout-cart-summary-lines">
                {cart.items.map(line => (
                    <li key={`${line.productId}:${line.sku}`} className="checkout-cart-summary__line" data-testid={`checkout-cart-summary-line-${line.sku}`}>
                        <span className="checkout-cart-summary__sku">{line.sku}</span>
                        <span className="checkout-cart-summary__qty">× {line.qty}</span>
                        <span className="checkout-cart-summary__price">{formatMoney(line.priceSnapshot * line.qty, line.currency)}</span>
                    </li>
                ))}
            </ul>
            <div className="checkout-cart-summary__total" data-testid="checkout-cart-summary-total">
                Total: {formatMoney(cart.subtotal, cart.currency)}
            </div>
        </aside>
    );
};

export default CheckoutCartSummary;
export {CheckoutCartSummary};
export {ECheckoutCartSummaryStyle, type ICheckoutCartSummary} from './CheckoutCartSummary.types';
