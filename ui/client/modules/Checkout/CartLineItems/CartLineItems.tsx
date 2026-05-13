/**
 * CartLineItems — Phase 1.D. Locked transactional section that
 * renders the live cart contents with qty controls. Operator can
 * edit headings/copy via the section editor; structure stays locked.
 */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {ICartLineItems} from './CartLineItems.types';
import './CartLineItems.scss';

export interface CartLineItemsProps {
    item: IItem;
}

function parseContent(raw: string | object | undefined): ICartLineItems {
    if (!raw) return {} as ICartLineItems;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as ICartLineItems; } catch { return {} as ICartLineItems; }
    }
    return raw as ICartLineItems;
}

const CartLineItems: React.FC<CartLineItemsProps> = ({item}) => {
    const c = parseContent(item.content);
    const title = c.title ?? 'Cart line items';
    return (
        <div className="cart-line-items" data-testid="module-cart-line-items">
            <h3 className="cart-line-items__title">{title}</h3>
            {c.body && <p className="cart-line-items__body">{c.body}</p>}
            <div className="cart-line-items__slot" data-testid="cart-line-items-slot" />
        </div>
    );
};

export default CartLineItems;
export {CartLineItems};
export {ECartLineItemsStyle, type ICartLineItems} from './CartLineItems.types';
