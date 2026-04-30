import React, {useState} from 'react';
import {useRouter} from 'next/router';
import Head from 'next/head';
import {Alert, Button, ConfigProvider, Form, Input, Typography, message} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {authorizeOrderPayment, finalizeOrder} from '@client/lib/checkout/api';

const isDev = process.env.NODE_ENV !== 'production';

const PaymentStep: React.FC = () => {
    const router = useRouter();
    const machine = useCheckoutMachine();
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [decline, setDecline] = useState<string | null>(null);

    if (!machine.orderId) {
        return <Typography.Text>Start at <a href="/checkout">/checkout</a></Typography.Text>;
    }

    const onSubmit = async (values: any) => {
        setSubmitting(true);
        setDecline(null);
        try {
            // Stable idempotency key per attempt — regen on each submit so
            // a user-driven retry doesn't replay the prior decline result.
            const idempotencyKey = `auth-${machine.orderId}-${Date.now()}`;
            const auth = await authorizeOrderPayment({orderId: machine.orderId!, card: values, idempotencyKey});
            if (!auth || (auth as any).error) {
                message.error((auth as any)?.error || 'Authorization failed.');
                return;
            }
            if (!auth.ok) {
                setDecline(auth.declineCode || 'declined');
                return;
            }
            // Authorize OK → capture immediately. (Auth+capture-as-one
            // matches the spec; provider distinguishes the two but the
            // UI runs them back-to-back.)
            const finIdem = `fin-${machine.orderId}-${Date.now()}`;
            const finalized = await finalizeOrder({orderId: machine.orderId!, idempotencyKey: finIdem});
            if (!finalized || (finalized as any).error) {
                message.error((finalized as any)?.error || 'Could not finalize order.');
                return;
            }
            const orderId = machine.orderId!;
            machine.reset();
            await router.push(`/checkout/confirmation/${orderId}`);
        } finally { setSubmitting(false); }
    };

    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Payment</title></Head>
            <div style={{maxWidth: 480, margin: '0 auto', padding: '32px 20px 80px'}}>
                <Typography.Title level={2}>Payment</Typography.Title>
                {isDev && (
                    <Alert type="info" showIcon style={{marginBottom: 16}} message="Dev tip: card 4000000000000002 always declines"/>
                )}
                {decline && (
                    <Alert type="error" showIcon style={{marginBottom: 16}} message={`Card declined (${decline}). Try another card.`}/>
                )}
                <Form form={form} layout="vertical" onFinish={onSubmit}>
                    <Form.Item name="number" label="Card number" rules={[{required: true}]}><Input maxLength={19}/></Form.Item>
                    <Form.Item name="exp" label="Expiration (MM/YY)" rules={[{required: true}]}><Input maxLength={5}/></Form.Item>
                    <Form.Item name="cvc" label="CVC" rules={[{required: true}]}><Input maxLength={4}/></Form.Item>
                    <Form.Item name="name" label="Name on card"><Input/></Form.Item>
                    <Button htmlType="submit" type="primary" block size="large" loading={submitting}>Place order</Button>
                </Form>
            </div>
        </ConfigProvider>
    );
};

export default PaymentStep;
