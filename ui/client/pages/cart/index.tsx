import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import {Button, ConfigProvider, Empty, Typography} from 'antd';
import {ArrowLeftOutlined} from '@client/lib/icons';
import staticTheme from '@client/features/Themes/themeConfig';
import CartLineItem from '../../components/cart/CartLineItem';
import {useCart} from '../../components/cart/useCart';

const formatPrice = (amount: number, currency: string | null) => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100);
    } catch {
        return `${(amount ?? 0) / 100} ${currency ?? ''}`;
    }
};

const CartPage: React.FC = () => {
    const {cart, loading, updateQty, removeItem, clear} = useCart();
    return (
        <ConfigProvider theme={staticTheme}>
            <Head>
                <title>Your cart</title>
            </Head>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                <Link href="/products"><Button type="link" icon={<ArrowLeftOutlined/>}>Continue shopping</Button></Link>
                <Typography.Title level={2} style={{marginTop: 8}}>Your cart</Typography.Title>
                {loading ? (
                    <Typography.Text type="secondary">Loading…</Typography.Text>
                ) : cart.items.length === 0 ? (
                    <Empty description="Your cart is empty"/>
                ) : (
                    <>
                        <div>
                            {cart.items.map(line => (
                                <CartLineItem
                                    key={`${line.productId}:${line.sku}`}
                                    line={line}
                                    onUpdateQty={(q) => updateQty(line.productId, line.sku, q)}
                                    onRemove={() => removeItem(line.productId, line.sku)}
                                />
                            ))}
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24}}>
                            <Button onClick={() => clear()}>Clear cart</Button>
                            <Typography.Title level={3} style={{margin: 0}}>
                                Subtotal: {formatPrice(cart.subtotal, cart.currency)}
                            </Typography.Title>
                        </div>
                        <Link href="/checkout" style={{display: 'block', marginTop: 16}}>
                            <Button block type="primary" size="large">Proceed to checkout</Button>
                        </Link>
                    </>
                )}
            </div>
        </ConfigProvider>
    );
};

export default CartPage;
