import React, {useState} from 'react';
import {useRouter} from 'next/router';
import Head from 'next/head';
import {Button, ConfigProvider, Form, Input, Typography, message} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {useCheckoutMachine} from './useCheckoutMachine';
import {attachOrderAddress} from './_api';

const AddressStep: React.FC = () => {
    const router = useRouter();
    const machine = useCheckoutMachine();
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (values: any) => {
        if (!machine.orderId) {
            await router.push('/checkout');
            return;
        }
        setSubmitting(true);
        try {
            const result = await attachOrderAddress({orderId: machine.orderId, shipping: values});
            if (!result || result.error) {
                message.error(result?.error || 'Could not save address.');
                return;
            }
            machine.goTo('shipping');
            await router.push('/checkout/shipping');
        } finally { setSubmitting(false); }
    };

    if (!machine.orderId) {
        return <Typography.Text>Start at <a href="/checkout">/checkout</a></Typography.Text>;
    }

    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Shipping address</title></Head>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                <Typography.Title level={2}>Shipping address</Typography.Title>
                <Form form={form} layout="vertical" onFinish={onSubmit}>
                    <Form.Item name="name" label="Full name" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item name="line1" label="Address line 1" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item name="line2" label="Address line 2"><Input/></Form.Item>
                    <Form.Item name="city" label="City" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item name="region" label="State / region" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item name="postalCode" label="Postal code" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item name="country" label="Country (2-letter)" rules={[{required: true, len: 2}]}><Input maxLength={2}/></Form.Item>
                    <Form.Item name="phone" label="Phone (optional)"><Input/></Form.Item>
                    <Button htmlType="submit" type="primary" block size="large" loading={submitting}>Continue</Button>
                </Form>
            </div>
        </ConfigProvider>
    );
};

export default AddressStep;
