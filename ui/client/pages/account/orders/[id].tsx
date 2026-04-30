import React, {useEffect, useState} from 'react';
import {GetServerSideProps} from 'next';
import {useRouter} from 'next/router';
import Link from 'next/link';
import {Card, ConfigProvider, Spin, Steps, Typography} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {requireCustomerSession} from '@client/lib/account/session';
import {myOrder, formatMoney} from '@client/lib/checkout/api';

const STATUS_ORDER = ['pending', 'paid', 'fulfilling', 'shipped', 'delivered'] as const;

const OrderDetail = () => {
    const router = useRouter();
    const id = typeof router.query.id === 'string' ? router.query.id : null;
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        myOrder(id).then(setOrder).finally(() => setLoading(false));
    }, [id]);

    const stepIndex = order ? STATUS_ORDER.indexOf(order.status) : -1;

    return (
        <ConfigProvider theme={staticTheme}>
            <div style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
                <Link href="/account/orders">← Back to orders</Link>
                {loading ? <Spin/> : !order ? (
                    <Typography.Text>Order not found.</Typography.Text>
                ) : (
                    <>
                        <Typography.Title level={2}>Order {order.orderNumber}</Typography.Title>
                        {stepIndex >= 0 && (
                            <Steps current={stepIndex} items={STATUS_ORDER.map(s => ({title: s}))} style={{marginBottom: 24}}/>
                        )}
                        {order.status === 'cancelled' && <Typography.Text type="warning">Cancelled</Typography.Text>}
                        {order.status === 'refunded' && <Typography.Text type="warning">Refunded</Typography.Text>}
                        <Card title="Items" style={{marginBottom: 16}}>
                            {order.lineItems.map((line: any) => (
                                <div key={`${line.productId}:${line.sku}`} style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span>{line.title} × {line.quantity}</span>
                                    <span>{formatMoney(line.lineTotal, order.currency)}</span>
                                </div>
                            ))}
                            <hr/>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Subtotal</span><span>{formatMoney(order.subtotal, order.currency)}</span></div>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Shipping</span><span>{formatMoney(order.shippingTotal, order.currency)}</span></div>
                            <div style={{display: 'flex', justifyContent: 'space-between'}}><span>Tax</span><span>{formatMoney(order.taxTotal, order.currency)}</span></div>
                            <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold'}}><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div>
                        </Card>
                        {order.shippingAddress && (
                            <Card title="Shipping address" style={{marginBottom: 16}}>
                                <div>{order.shippingAddress.name}</div>
                                <div>{order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}</div>
                                <div>{order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}</div>
                                <div>{order.shippingAddress.country}</div>
                            </Card>
                        )}
                        <Card title="Status history">
                            {order.statusHistory.map((entry: any, i: number) => (
                                <div key={i}>
                                    <strong>{entry.status}</strong> @ {new Date(entry.at).toLocaleString()}
                                    {entry.by ? ` — ${entry.by}` : ''}
                                    {entry.note ? ` (${entry.note})` : ''}
                                </div>
                            ))}
                        </Card>
                    </>
                )}
            </div>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {session: guard.session}};
};

export default OrderDetail;
