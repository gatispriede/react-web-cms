import React, {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {Card, ConfigProvider, Spin, Typography} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {formatMoney, myOrder, orderByToken} from '../_api';

/**
 * Confirmation page. Reads via `myOrder` first (works for signed-in
 * customers); if that returns null, falls back to `orderByToken` with
 * the `?t=` query param so guests can land here after the cookie was
 * just minted by the finalize mutation.
 *
 * The cookie itself is HttpOnly + Path=/checkout, so the read happens
 * server-side via the resolver — we just pass the token argument and
 * the resolver compares it against the cookie.
 */
const ConfirmationPage: React.FC = () => {
    const router = useRouter();
    const id = typeof router.query.id === 'string' ? router.query.id : null;
    const tokenArg = typeof router.query.t === 'string' ? router.query.t : null;
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        (async () => {
            const own = await myOrder(id).catch(() => null);
            if (cancelled) return;
            if (own) { setOrder(own); setLoading(false); return; }
            if (tokenArg) {
                const guest = await orderByToken(tokenArg).catch(() => null);
                if (cancelled) return;
                setOrder(guest);
            }
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [id, tokenArg]);

    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Order confirmation</title></Head>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                {loading ? <Spin/> : !order ? (
                    <Typography.Text type="secondary">Order not found. <Link href="/products">Continue shopping</Link></Typography.Text>
                ) : (
                    <>
                        <Typography.Title level={2}>Thank you!</Typography.Title>
                        <Typography.Paragraph>Your order <strong>{order.orderNumber}</strong> is confirmed.</Typography.Paragraph>
                        <Card title="Summary" style={{marginBottom: 16}}>
                            {order.lineItems.map((line: any) => (
                                <div key={`${line.productId}:${line.sku}`} style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span>{line.title} ({line.sku}) × {line.quantity}</span>
                                    <span>{formatMoney(line.lineTotal, order.currency)}</span>
                                </div>
                            ))}
                            <hr/>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Subtotal</span><span>{formatMoney(order.subtotal, order.currency)}</span></div>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Shipping</span><span>{formatMoney(order.shippingTotal, order.currency)}</span></div>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Tax</span><span>{formatMoney(order.taxTotal, order.currency)}</span></div>
                            <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold'}}><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
                        </Card>
                        <Link href="/products">Continue shopping</Link>
                    </>
                )}
            </div>
        </ConfigProvider>
    );
};

export default ConfirmationPage;
