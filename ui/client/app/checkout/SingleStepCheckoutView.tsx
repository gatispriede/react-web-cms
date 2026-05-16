'use client';
/**
 * Client view for `/checkout` single-step flow — App Router migration,
 * Batch 5. Direct lift of the former `pages/checkout/index.tsx`'s
 * `SingleStepCheckout` component minus the SSR data fetch (moved to the
 * server file) and the multi-step redirect (handled server-side).
 *
 * Router API: navigation done via `next/navigation` `useRouter()` —
 * `push()` is the only method we use here, same shape as the old
 * `next/router` `push()`.
 */
import React, {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {Alert, Button, Card, ConfigProvider, Empty, Form, Input, Radio, Space, Typography, message} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {useCart} from '@client/features/Cart/useCart';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {createDraftOrder, formatMoney} from '@client/lib/checkout/api';

interface SingleStepCheckoutViewProps {
    providers: Array<{id: string; displayName: string}>;
}

const SingleStepCheckoutView: React.FC<SingleStepCheckoutViewProps> = ({providers}) => {
    const router = useRouter();
    const {cart, loading} = useCart();
    const machine = useCheckoutMachine();
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();
    const [provider, setProvider] = useState<string>(providers[0]?.id ?? 'bankTransfer');

    useEffect(() => {
        // Resume an in-flight multi-step session if the operator just
        // flipped the flag — kick the user back to where they left off.
        if (machine.orderId && machine.step !== 'cart') {
            router.push(`/checkout/${machine.step}`);
        }
    }, [machine.orderId, machine.step, router]);

    const onSubmit = async (values: Record<string, unknown>) => {
        if (!cart.items.length) return;
        setSubmitting(true);
        try {
            const draft = await createDraftOrder({
                currency: cart.currency || 'EUR',
                guestEmail: typeof values.email === 'string' ? values.email : undefined,
            });
            if (!draft || (draft as {error?: string}).error) {
                message.error((draft as {error?: string})?.error || 'Could not start checkout.');
                return;
            }
            machine.setOrderId(draft.id as string);
            router.push(`/checkout/confirmation/${draft.id}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ConfigProvider theme={staticTheme}>
            <div style={{maxWidth: 960, margin: '0 auto', padding: '32px 20px 80px'}}>
                <Link href="/cart"><Button type="link">← Back to cart</Button></Link>
                <Typography.Title level={2}>Checkout</Typography.Title>
                {loading ? <Typography.Text type="secondary">Loading…</Typography.Text> : cart.items.length === 0 ? (
                    <Empty description="Your cart is empty"/>
                ) : (
                    <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24}}>
                        <Form form={form} layout="vertical" onFinish={onSubmit}>
                            <Card title="Address" style={{marginBottom: 16}} data-testid="single-step-address">
                                <Form.Item name="email" label="Email" rules={[{required: true, type: 'email'}]}>
                                    <Input data-testid="single-step-email"/>
                                </Form.Item>
                                <Form.Item name="name" label="Full name" rules={[{required: true}]}>
                                    <Input data-testid="single-step-name"/>
                                </Form.Item>
                                <Form.Item name="line1" label="Address line 1" rules={[{required: true}]}>
                                    <Input data-testid="single-step-line1"/>
                                </Form.Item>
                                <Form.Item name="city" label="City" rules={[{required: true}]}>
                                    <Input data-testid="single-step-city"/>
                                </Form.Item>
                                <Form.Item name="postalCode" label="Postal code" rules={[{required: true}]}>
                                    <Input data-testid="single-step-postal"/>
                                </Form.Item>
                                <Form.Item name="country" label="Country" rules={[{required: true}]}>
                                    <Input data-testid="single-step-country"/>
                                </Form.Item>
                            </Card>
                            <Card title="Payment method" style={{marginBottom: 16}} data-testid="single-step-payment">
                                {providers.length === 0 ? (
                                    <Alert type="warning" message="No payment providers enabled."/>
                                ) : (
                                    <Radio.Group
                                        data-testid="single-step-provider-radio"
                                        value={provider}
                                        onChange={(e) => setProvider(e.target.value)}
                                    >
                                        <Space direction="vertical">
                                            {providers.map(p => (
                                                <Radio key={p.id} value={p.id} data-testid={`single-step-provider-${p.id}`}>
                                                    {p.displayName}
                                                </Radio>
                                            ))}
                                        </Space>
                                    </Radio.Group>
                                )}
                            </Card>
                            <Button
                                data-testid="single-step-place-order-btn"
                                htmlType="submit"
                                type="primary"
                                block
                                size="large"
                                loading={submitting}
                                disabled={providers.length === 0}
                            >
                                Place order
                            </Button>
                        </Form>
                        <Card title="Order summary" data-testid="single-step-summary" style={{position: 'sticky', top: 16, alignSelf: 'flex-start'}}>
                            {cart.items.map(line => (
                                <div key={`${line.productId}:${line.sku}`} style={{display: 'flex', justifyContent: 'space-between', padding: '6px 0'}}>
                                    <span>{line.sku} × {line.qty}</span>
                                    <span>{formatMoney(line.qty * line.priceSnapshot, line.currency)}</span>
                                </div>
                            ))}
                            <hr/>
                            <Typography.Title level={4}>Total: {formatMoney(cart.subtotal, cart.currency)}</Typography.Title>
                        </Card>
                    </div>
                )}
            </div>
        </ConfigProvider>
    );
};

export default SingleStepCheckoutView;
