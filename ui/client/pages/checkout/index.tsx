import React, {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {Button, ConfigProvider, Empty, Input, Typography, message} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {useCart} from '@client/components/cart/useCart';
import {useCheckoutMachine} from './useCheckoutMachine';
import {createDraftOrder, formatMoney} from './_api';

/**
 * Step 1 — review cart, capture optional guest email, create the
 * draft order. The draft creation is what commits a stock reservation,
 * so we run it on click rather than on mount to avoid background-tab
 * reservation pile-up.
 */
const CheckoutIndex: React.FC = () => {
    const router = useRouter();
    const {cart, loading} = useCart();
    const machine = useCheckoutMachine();
    const [guestEmail, setGuestEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // If we already have a draft and the cart is empty, fast-forward
        // to the right step on resume.
        if (machine.orderId && machine.step !== 'cart') {
            void router.push(`/checkout/${machine.step}`);
        }
    }, [machine.orderId, machine.step, router]);

    const onProceed = async () => {
        if (!cart.items.length) return;
        setSubmitting(true);
        try {
            const result = await createDraftOrder({
                currency: cart.currency || 'USD',
                guestEmail: guestEmail || undefined,
            });
            if (!result || result.error) {
                message.error(result?.error || 'Could not start checkout.');
                return;
            }
            machine.setOrderId(result.id as string);
            machine.goTo('address');
            await router.push('/checkout/address');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Checkout</title></Head>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                <Link href="/cart"><Button type="link">← Back to cart</Button></Link>
                <Typography.Title level={2}>Checkout</Typography.Title>
                {loading ? <Typography.Text type="secondary">Loading…</Typography.Text> : cart.items.length === 0 ? (
                    <Empty description="Your cart is empty"/>
                ) : (
                    <>
                        <div style={{marginBottom: 16}}>
                            {cart.items.map(line => (
                                <div key={`${line.productId}:${line.sku}`} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee'}}>
                                    <span>{line.sku} × {line.qty}</span>
                                    <span>{formatMoney(line.qty * line.priceSnapshot, line.currency)}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{marginBottom: 16}}>
                            <label>Email (for guest checkout)</label>
                            <Input value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="you@example.com" type="email"/>
                        </div>
                        <Typography.Title level={4}>Subtotal: {formatMoney(cart.subtotal, cart.currency)}</Typography.Title>
                        <Button block type="primary" size="large" loading={submitting} onClick={onProceed}>Proceed to address</Button>
                    </>
                )}
            </div>
        </ConfigProvider>
    );
};

export default CheckoutIndex;
