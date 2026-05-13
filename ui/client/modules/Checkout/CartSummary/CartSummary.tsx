/** CartSummary — Phase 1.D. Locked subtotal/VAT/shipping/total panel. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {ICartSummary} from './CartSummary.types';
import './CartSummary.scss';

export interface CartSummaryProps { item: IItem; }

function parseContent(raw: string | object | undefined): ICartSummary {
    if (!raw) return {} as ICartSummary;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICartSummary; } catch { return {} as ICartSummary; } }
    return raw as ICartSummary;
}

const CartSummary: React.FC<CartSummaryProps> = ({item}) => {
    const c = parseContent(item.content);
    return (
        <div className="cart-summary" data-testid="module-cart-summary">
            <h3 className="cart-summary__title">{c.title ?? 'Summary'}</h3>
            <dl className="cart-summary__rows" data-testid="cart-summary-rows">
                <div><dt>Subtotal</dt><dd data-testid="cart-summary-subtotal">—</dd></div>
                <div><dt>Shipping</dt><dd>—</dd></div>
                <div><dt>VAT</dt><dd>—</dd></div>
                <div className="cart-summary__total"><dt>Total</dt><dd data-testid="cart-summary-total">—</dd></div>
            </dl>
        </div>
    );
};

export default CartSummary;
export {CartSummary};
export {ECartSummaryStyle, type ICartSummary} from './CartSummary.types';
