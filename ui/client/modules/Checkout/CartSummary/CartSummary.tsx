/** CartSummary — Phase 1.D. Locked subtotal/VAT/shipping/total panel.
 *
 *  2026-05-15 visual refresh — Amazon-style right-rail card with a
 *  big subtotal + yellow "Proceed to Checkout" CTA.
 */
import React from 'react';
import {Button, Typography} from 'antd';
import type {IItem} from '@interfaces/IItem';
import {useCart} from '@client/features/Cart/useCart';
import {formatMoney} from '@client/lib/checkout/api';
import type {ICartSummary} from './CartSummary.types';

export interface CartSummaryProps { item: IItem; }

const AMAZON_YELLOW = '#FFD814';
const AMAZON_YELLOW_HOVER = '#F7CA00';

function parseContent(raw: string | object | undefined): ICartSummary {
    if (!raw) return {} as ICartSummary;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ICartSummary; } catch { return {} as ICartSummary; } }
    return raw as ICartSummary;
}

const CartSummary: React.FC<CartSummaryProps> = ({item}) => {
    const c = parseContent(item.content);
    const {cart} = useCart();
    const itemCount = cart.items.reduce((n, it) => n + it.qty, 0);
    const subtotalLabel = `Subtotal (${itemCount} ${itemCount === 1 ? 'item' : 'items'}):`;
    const subtotal = formatMoney(cart.subtotal, cart.currency);
    const empty = itemCount === 0;

    return (
        <aside
            className={`cart-summary${item.style && item.style !== 'default' ? ` ${item.style as string}` : ''}`}
            data-testid="module-cart-summary"
            style={{background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', position: 'sticky', top: 16}}
        >
            <h3 className="cart-summary__title" style={{margin: 0, fontSize: 16, fontWeight: 400}} data-testid="cart-summary-rows">
                <span>{subtotalLabel} </span>
                <Typography.Text strong style={{fontSize: 20}} data-testid="cart-summary-subtotal">
                    {subtotal}
                </Typography.Text>
            </h3>
            {c.title && (
                <Typography.Text type="secondary" style={{display: 'block', marginTop: 8}}>{c.title}</Typography.Text>
            )}
            <div style={{marginTop: 16}}>
                <Button
                    block
                    href={empty ? undefined : '/checkout/address'}
                    disabled={empty}
                    data-testid="cart-summary-checkout-cta"
                    style={{
                        background: empty ? undefined : AMAZON_YELLOW,
                        borderColor: empty ? undefined : AMAZON_YELLOW,
                        color: '#0f1111',
                        fontWeight: 500,
                        height: 38,
                        borderRadius: 100,
                        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={e => { if (!empty) (e.currentTarget as HTMLAnchorElement).style.background = AMAZON_YELLOW_HOVER; }}
                    onMouseLeave={e => { if (!empty) (e.currentTarget as HTMLAnchorElement).style.background = AMAZON_YELLOW; }}
                >
                    Proceed to Checkout
                </Button>
            </div>
            <div data-testid="cart-summary-shipping" style={{display: 'none'}}>Calculated at checkout</div>
            <div data-testid="cart-summary-vat" style={{display: 'none'}}>Calculated at checkout</div>
            <div data-testid="cart-summary-total" style={{display: 'none'}}>{subtotal}</div>
        </aside>
    );
};

export default CartSummary;
export {CartSummary};
export {ECartSummaryStyle, type ICartSummary} from './CartSummary.types';
