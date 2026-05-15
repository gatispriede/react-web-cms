import React, {useState} from 'react';
import {Button, Form, Input, List, Modal, Select, Switch, Tag} from 'antd';
import {toast} from 'sonner';
import type {IUser} from '@interfaces/IUser';
import {mcpCall} from './mcpClient';

/**
 * Payment-methods tab — surfaces Stripe-tokenized refs.
 *
 * NOTE: raw card collection happens inside the provider's Elements /
 * hosted page; the form here only accepts the already-tokenized
 * `tokenizedId` returned by Stripe.js (the page wires the provider
 * SDK separately). For dev / catalogue-only setups the form is still
 * usable to register a placeholder ref so the default-method picker
 * works end-to-end.
 */
const PROVIDER_OPTIONS = [
    {value: 'stripe', label: 'Stripe'},
    {value: 'paypal', label: 'PayPal'},
    {value: 'klarna', label: 'Klarna'},
];

export const PaymentMethodsForm: React.FC<{me: IUser; onMutated: () => void}> = ({me, onMutated}) => {
    const [adding, setAdding] = useState(false);
    const [form] = Form.useForm();
    const list = me.paymentMethods ?? [];

    const onAdd = async (values: Record<string, unknown>) => {
        try {
            await mcpCall('customer.paymentMethods.add', {userId: me.id, ref: values});
            toast.success('Payment method added');
            setAdding(false);
            form.resetFields();
            onMutated();
        } catch (e) {
            toast.error(`Add failed: ${(e as Error).message}`);
        }
    };
    const onRemove = async (refId: string) => {
        try {
            await mcpCall('customer.paymentMethods.remove', {userId: me.id, refId});
            toast.success('Removed');
            onMutated();
        } catch (e) {
            toast.error(`Delete failed: ${(e as Error).message}`);
        }
    };
    const onSetDefault = async (refId: string) => {
        try {
            await mcpCall('customer.paymentMethods.setDefault', {userId: me.id, refId});
            toast.success('Default updated');
            onMutated();
        } catch (e) {
            toast.error(`Update failed: ${(e as Error).message}`);
        }
    };

    return (
        <div data-testid="payment-methods-form">
            <List
                bordered
                dataSource={list}
                locale={{emptyText: 'No saved payment methods'}}
                renderItem={m => (
                    <List.Item
                        data-testid={`pm-row-${m.id}`}
                        actions={[
                            m.isDefault ? <Tag color="green" key="def" data-testid={`pm-default-${m.id}`}>Default</Tag>
                                : <Button key="set" size="small" onClick={() => void onSetDefault(m.id)} data-testid={`pm-setdefault-${m.id}`}>Set default</Button>,
                            <Button key="del" size="small" danger onClick={() => void onRemove(m.id)} data-testid={`pm-remove-${m.id}`}>Remove</Button>,
                        ]}
                    >
                        <List.Item.Meta
                            title={`${m.provider.toUpperCase()} •••• ${m.last4 ?? '????'}`}
                            description={m.expiryMonth && m.expiryYear ? `Expires ${m.expiryMonth}/${m.expiryYear}` : 'Tokenized'}
                        />
                    </List.Item>
                )}
            />
            <Button type="primary" style={{marginTop: 12}} onClick={() => setAdding(true)} data-testid="pm-add-btn">Add payment method</Button>
            <Modal open={adding} onCancel={() => setAdding(false)} footer={null} title="Add payment method" destroyOnClose>
                <Form form={form} layout="vertical" onFinish={onAdd}>
                    <Form.Item label="Provider" name="provider" rules={[{required: true}]}>
                        <Select options={PROVIDER_OPTIONS} data-testid="pm-new-provider-select"/>
                    </Form.Item>
                    <Form.Item label="Tokenized id" name="tokenizedId" rules={[{required: true}]}>
                        <Input data-testid="pm-new-token-input"/>
                    </Form.Item>
                    <Form.Item label="Last 4" name="last4">
                        <Input maxLength={4} data-testid="pm-new-last4-input"/>
                    </Form.Item>
                    <Form.Item label="Set as default" name="isDefault" valuePropName="checked">
                        <Switch data-testid="pm-new-default-switch"/>
                    </Form.Item>
                    <Button type="primary" htmlType="submit" data-testid="pm-new-save-btn">Save</Button>
                </Form>
            </Modal>
        </div>
    );
};

export default PaymentMethodsForm;
