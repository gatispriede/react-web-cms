import React from 'react';
import Link from 'next/link';
import {Button, Drawer, Empty, Typography} from 'antd';
import CartLineItem from './CartLineItem';
import {useCart} from './useCart';

const formatPrice = (amount: number, currency: string | null) => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100);
    } catch {
        return `${(amount ?? 0) / 100} ${currency ?? ''}`;
    }
};

interface Props {
    open: boolean;
    onClose: () => void;
}

const CartDrawer: React.FC<Props> = ({open, onClose}) => {
    const {cart, loading, updateQty, removeItem} = useCart();
    return (
        <Drawer title="Your cart" open={open} onClose={onClose} width={420}>
            {loading ? (
                <Typography.Text type="secondary">Loading…</Typography.Text>
            ) : cart.items.length === 0 ? (
                <Empty description="Your cart is empty"/>
            ) : (
                <>
                    {cart.items.map(line => (
                        <CartLineItem
                            key={`${line.productId}:${line.sku}`}
                            line={line}
                            onUpdateQty={(q) => updateQty(line.productId, line.sku, q)}
                            onRemove={() => removeItem(line.productId, line.sku)}
                        />
                    ))}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16}}>
                        <Typography.Text strong>Subtotal</Typography.Text>
                        <Typography.Text strong>{formatPrice(cart.subtotal, cart.currency)}</Typography.Text>
                    </div>
                    <Link href="/cart" style={{display: 'block', marginTop: 12}}>
                        <Button block onClick={onClose}>View cart</Button>
                    </Link>
                    <Link href="/checkout" style={{display: 'block', marginTop: 8}}>
                        <Button block type="primary">Proceed to checkout</Button>
                    </Link>
                </>
            )}
        </Drawer>
    );
};

export default CartDrawer;
