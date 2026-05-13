/** CartActions — Phase 1.D. Locked Clear cart + Proceed to checkout CTAs. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {ICartActions} from './CartActions.types';
import './CartActions.scss';

export interface CartActionsProps { item: IItem; }

function parseContent(raw: string | object | undefined): ICartActions {
    if (!raw) return {} as ICartActions;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICartActions; } catch { return {} as ICartActions; } }
    return raw as ICartActions;
}

const CartActions: React.FC<CartActionsProps> = ({item}) => {
    const c = parseContent(item.content);
    const proceedLabel = c.proceedLabel ?? 'Proceed to checkout';
    const clearLabel = c.clearLabel ?? 'Clear cart';
    return (
        <div className="cart-actions" data-testid="module-cart-actions">
            <button type="button" className="cart-actions__clear" data-testid="cart-actions-clear">{clearLabel}</button>
            <a className="cart-actions__proceed" href="/checkout/address" data-testid="cart-actions-proceed">{proceedLabel}</a>
        </div>
    );
};

export default CartActions;
export {CartActions};
export {ECartActionsStyle, type ICartActions} from './CartActions.types';
