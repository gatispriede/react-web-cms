import React, {useEffect, useState} from 'react';
import {Button, Divider, Drawer, Empty, Space, Typography} from 'antd';
import {DeleteOutlined, ShoppingCartOutlined} from '@ant-design/icons';
import {useCommerceFlags} from './useCommerceFlags';
import {useCart} from '@client/features/Cart/useCart';
import {formatMoney} from '@client/lib/checkout/api';
import {subscribeCartDrawer} from './cartDrawerBus';

/**
 * Slide-out cart panel. Mounts at the top of `_app.tsx` so any page can
 * open it via the cart-drawer bus. Returns `null` when checkout is
 * disabled (no DOM, no JS subscription).
 *
 * Built on AntD `<Drawer>` — gets the slide animation, backdrop, focus
 * trap and esc-to-close behaviour for free. The earlier hand-rolled
 * `<aside class="cart-drawer">` had no SCSS file shipping with it, so
 * the panel rendered as bare HTML in the page flow with the order
 * summary above it.
 */
const CartDrawer: React.FC = () => {
    const flags = useCommerceFlags();
    const {cart, removeItem} = useCart();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!flags.checkoutEnabled) return;
        return subscribeCartDrawer(() => setOpen(true));
    }, [flags.checkoutEnabled]);

    if (!flags.checkoutEnabled) return null;

    const itemCount = cart.items.reduce((n, it) => n + it.qty, 0);

    return (
        <Drawer
            title={
                <Space>
                    <ShoppingCartOutlined/>
                    <span>Your cart</span>
                    {itemCount > 0 && <Typography.Text type="secondary">({itemCount})</Typography.Text>}
                </Space>
            }
            placement="right"
            // AntD v5 deprecates Drawer `width` in favour of preset `size`.
            // `default` is 378px, which matches the previous 400 within a
            // rounding error.
            size="default"
            open={open}
            onClose={() => setOpen(false)}
            data-testid="cart-drawer"
            footer={
                cart.items.length > 0 ? (
                    <Space style={{width: '100%', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                            <Typography.Text type="secondary">Subtotal</Typography.Text>
                            <div>
                                <Typography.Text strong style={{fontSize: 18}}>
                                    {formatMoney(cart.subtotal, cart.currency)}
                                </Typography.Text>
                            </div>
                        </div>
                        <Button
                            type="primary"
                            size="large"
                            href="/checkout/address"
                            data-testid="cart-drawer-checkout-link"
                        >
                            Checkout
                        </Button>
                    </Space>
                ) : null
            }
        >
            {cart.items.length === 0 ? (
                <Empty description="Your cart is empty"/>
            ) : (
                <Space direction="vertical" style={{width: '100%'}} size={0}>
                    {cart.items.map((it, idx) => (
                        <React.Fragment key={`${it.productId}:${it.sku}`}>
                            {idx > 0 && <Divider style={{margin: '12px 0'}}/>}
                            <div style={{display: 'flex', alignItems: 'flex-start', gap: 12}}>
                                <div style={{flex: 1, minWidth: 0}}>
                                    <Typography.Text strong style={{display: 'block'}}>
                                        {it.title ?? it.productId}
                                    </Typography.Text>
                                    <Typography.Text type="secondary" style={{fontSize: 12}}>{it.sku}</Typography.Text>
                                    <div style={{marginTop: 4}}>
                                        <Typography.Text>
                                            {it.qty} × {formatMoney(it.priceSnapshot, it.currency || cart.currency)}
                                        </Typography.Text>
                                    </div>
                                </div>
                                <Button
                                    size="small"
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined/>}
                                    data-testid={`cart-drawer-remove-${it.productId}`}
                                    onClick={() => void removeItem(it.productId, it.sku)}
                                    aria-label="Remove from cart"
                                />
                            </div>
                        </React.Fragment>
                    ))}
                </Space>
            )}
        </Drawer>
    );
};

export default CartDrawer;
