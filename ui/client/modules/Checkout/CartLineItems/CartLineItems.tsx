/**
 * CartLineItems — Phase 1.D. Locked transactional section that
 * renders the live cart contents with qty controls. Operator can
 * edit headings/copy via the section editor; structure stays locked.
 */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import {useCart} from '@client/features/Cart/useCart';
import {formatMoney} from '@client/lib/checkout/api';
import type {ICartLineItems} from './CartLineItems.types';

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
    const {cart, loading, updateQty, removeItem} = useCart();
    const title = c.title ?? 'Cart line items';
    const emptyLabel = c.body ?? 'Your cart is empty.';
    return (
        <div className="cart-line-items" data-testid="module-cart-line-items">
            <h3 className="cart-line-items__title">{title}</h3>
            <div className="cart-line-items__slot" data-testid="cart-line-items-slot">
                {loading && cart.items.length === 0 ? (
                    <p className="cart-line-items__loading" data-testid="cart-line-items-loading">Loading…</p>
                ) : cart.items.length === 0 ? (
                    <p className="cart-line-items__empty" data-testid="cart-line-items-empty">{emptyLabel}</p>
                ) : (
                    <ul className="cart-line-items__list" data-testid="cart-line-items-list">
                        {cart.items.map(line => {
                            const lineTotal = line.priceSnapshot * line.qty;
                            const key = `${line.productId}:${line.sku}`;
                            return (
                                <li key={key} className="cart-line-items__row" data-testid={`cart-line-items-row-${line.sku}`}>
                                    <span className="cart-line-items__sku" data-testid={`cart-line-items-sku-${line.sku}`}>{line.sku}</span>
                                    <span className="cart-line-items__price" data-testid={`cart-line-items-price-${line.sku}`}>{formatMoney(line.priceSnapshot, line.currency)}</span>
                                    <input
                                        type="number"
                                        min={1}
                                        className="cart-line-items__qty"
                                        data-testid={`cart-line-items-qty-${line.sku}`}
                                        value={line.qty}
                                        onChange={e => {
                                            const next = Math.max(1, Number(e.target.value) || 1);
                                            void updateQty(line.productId, line.sku, next);
                                        }}
                                    />
                                    <span className="cart-line-items__line-total" data-testid={`cart-line-items-line-total-${line.sku}`}>{formatMoney(lineTotal, line.currency)}</span>
                                    <button
                                        type="button"
                                        className="cart-line-items__remove"
                                        data-testid={`cart-line-items-remove-${line.sku}`}
                                        onClick={() => { void removeItem(line.productId, line.sku); }}
                                    >Remove</button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default CartLineItems;
export {CartLineItems};
export {ECartLineItemsStyle, type ICartLineItems} from './CartLineItems.types';
