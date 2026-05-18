/**
 * CartLineItems — Phase 1.D. Locked transactional section that
 * renders the live cart contents with qty controls.
 *
 * 2026-05-15 visual refresh — Amazon-style rows: product image (with
 * category-fallback placeholder), title, In-stock badge, qty stepper,
 * Delete button, and a right-aligned per-line price. Structure stays
 * locked (operator can edit copy/title only via the section editor).
 */
import React from 'react';
import {Button, Divider, Empty, InputNumber, Space, Tag, Typography} from 'antd';
import {DeleteOutlined} from '@ant-design/icons';
import type {IItem} from '@interfaces/IItem';
import {useCart} from '@client/features/Cart/useCart';
import {formatMoney} from '@client/lib/checkout/api';
import {placeholderForCategories} from '@client/lib/productImage';
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
    const title = c.title ?? 'Shopping Basket';
    const emptyLabel = c.body ?? 'Your basket is empty.';

    return (
        <section
            className={`cart-line-items${item.style && item.style !== 'default' ? ` ${item.style as string}` : ''}`}
            data-testid="module-cart-line-items"
            style={{background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)'}}
        >
            <Typography.Title level={2} className="cart-line-items__title" style={{marginTop: 0, marginBottom: 4}}>{title}</Typography.Title>
            <Typography.Text className="cart-line-items__subtotal-top" type="secondary" style={{display: 'block', textAlign: 'right', marginBottom: 16}}>
                Price
            </Typography.Text>
            <Divider style={{margin: 0}}/>
            <div className="cart-line-items__slot" data-testid="cart-line-items-slot">
                {loading && cart.items.length === 0 ? (
                    <Typography.Paragraph className="cart-line-items__loading" data-testid="cart-line-items-loading" style={{padding: '24px 0'}}>
                        Loading…
                    </Typography.Paragraph>
                ) : cart.items.length === 0 ? (
                    <div style={{padding: '32px 0'}} data-testid="cart-line-items-empty">
                        <Empty description={emptyLabel}/>
                    </div>
                ) : (
                    <ul className="cart-line-items__list" data-testid="cart-line-items-list" style={{listStyle: 'none', padding: 0, margin: 0}}>
                        {cart.items.map((line, idx) => {
                            const lineTotal = line.priceSnapshot * line.qty;
                            const key = `${line.productId}:${line.sku}`;
                            const fallbackImage = placeholderForCategories(undefined); // resolved on detail page; here categories aren't carried on the line
                            return (
                                <React.Fragment key={key}>
                                    {idx > 0 && <Divider style={{margin: 0}}/>}
                                    <li
                                        className="cart-line-items__row"
                                        data-testid={`cart-line-items-row-${line.sku}`}
                                        style={{display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 20, padding: '20px 0', alignItems: 'flex-start'}}
                                    >
                                        <div style={{width: 120, height: 120, background: '#fafafa', borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                            <img src={fallbackImage} alt={line.title ?? line.sku} style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}}/>
                                        </div>
                                        <div style={{minWidth: 0}}>
                                            <Typography.Title level={5} style={{marginTop: 0, marginBottom: 4}}>
                                                {line.title ?? line.sku}
                                            </Typography.Title>
                                            <Typography.Text type="secondary" style={{fontSize: 12, display: 'block', marginBottom: 6}} data-testid={`cart-line-items-sku-${line.sku}`}>
                                                SKU: {line.sku}
                                            </Typography.Text>
                                            <Tag color="green" style={{marginBottom: 12}}>In stock</Tag>
                                            <Space size={8} align="center" wrap>
                                                <InputNumber
                                                    min={1}
                                                    size="small"
                                                    value={line.qty}
                                                    data-testid={`cart-line-items-qty-${line.sku}`}
                                                    onChange={(v) => {
                                                        const next = Math.max(1, Number(v) || 1);
                                                        void updateQty(line.productId, line.sku, next);
                                                    }}
                                                    style={{width: 80}}
                                                />
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<DeleteOutlined/>}
                                                    danger
                                                    data-testid={`cart-line-items-remove-${line.sku}`}
                                                    onClick={() => { void removeItem(line.productId, line.sku); }}
                                                >Delete</Button>
                                            </Space>
                                        </div>
                                        <div style={{textAlign: 'right'}}>
                                            <Typography.Text strong style={{fontSize: 18}} data-testid={`cart-line-items-line-total-${line.sku}`}>
                                                {formatMoney(lineTotal, line.currency)}
                                            </Typography.Text>
                                            {line.qty > 1 && (
                                                <div>
                                                    <Typography.Text type="secondary" style={{fontSize: 12}} data-testid={`cart-line-items-price-${line.sku}`}>
                                                        {formatMoney(line.priceSnapshot, line.currency)} each
                                                    </Typography.Text>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                </React.Fragment>
                            );
                        })}
                    </ul>
                )}
                {cart.items.length > 0 && (
                    <>
                        <Divider style={{margin: 0}}/>
                        <div style={{textAlign: 'right', padding: '16px 0 0'}}>
                            <Typography.Text>Subtotal ({cart.items.reduce((n, it) => n + it.qty, 0)} {cart.items.length === 1 ? 'item' : 'items'}): </Typography.Text>
                            <Typography.Text strong style={{fontSize: 18}} data-testid="cart-line-items-subtotal">
                                {formatMoney(cart.subtotal, cart.currency)}
                            </Typography.Text>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default CartLineItems;
export {CartLineItems};
export {ECartLineItemsStyle, type ICartLineItems} from './CartLineItems.types';
