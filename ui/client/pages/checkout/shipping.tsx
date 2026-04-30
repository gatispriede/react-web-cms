import React, {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import Head from 'next/head';
import {Button, ConfigProvider, Radio, Typography, message} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {useCheckoutMachine} from '@client/lib/checkout/useCheckoutMachine';
import {attachOrderShipping, formatMoney, shippingMethodsFor} from '@client/lib/checkout/api';

const ShippingStep: React.FC = () => {
    const router = useRouter();
    const machine = useCheckoutMachine();
    const [methods, setMethods] = useState<any[]>([]);
    const [picked, setPicked] = useState<string>('standard');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!machine.orderId) return;
        void shippingMethodsFor(machine.orderId).then(setMethods);
    }, [machine.orderId]);

    if (!machine.orderId) {
        return <Typography.Text>Start at <a href="/checkout">/checkout</a></Typography.Text>;
    }

    const onSubmit = async () => {
        setSubmitting(true);
        try {
            const result = await attachOrderShipping({orderId: machine.orderId!, methodCode: picked});
            if (!result || result.error) {
                message.error(result?.error || 'Could not save shipping method.');
                return;
            }
            machine.goTo('payment');
            await router.push('/checkout/payment');
        } finally { setSubmitting(false); }
    };

    return (
        <ConfigProvider theme={staticTheme}>
            <Head><title>Shipping method</title></Head>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px'}}>
                <Typography.Title level={2}>Shipping method</Typography.Title>
                <Radio.Group value={picked} onChange={e => setPicked(e.target.value)} style={{width: '100%'}}>
                    {methods.map(m => (
                        <div key={m.code} style={{padding: '12px 0', borderBottom: '1px solid #eee'}}>
                            <Radio value={m.code}>
                                <strong>{m.label}</strong> — {formatMoney(m.price, 'USD')} ({m.etaDays} days)
                            </Radio>
                        </div>
                    ))}
                </Radio.Group>
                <Button block type="primary" size="large" loading={submitting} onClick={onSubmit} style={{marginTop: 16}}>Continue to payment</Button>
            </div>
        </ConfigProvider>
    );
};

export default ShippingStep;
