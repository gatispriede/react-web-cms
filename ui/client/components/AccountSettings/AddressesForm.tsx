import React, {useState} from 'react';
import {Alert, Button, Form, Input, List, Modal, Switch, Tag} from 'antd';
import {toast} from 'sonner';
import type {IUser, IAddress} from '@interfaces/IUser';
import {mcpCall} from './mcpClient';

/**
 * Addresses tab — CRUD over `IUser.shippingAddresses`. Company-type
 * customers additionally see a split between billing-address (lives
 * on `company.billingAddress`) and shipping-addresses[].
 */

const AddressFields: React.FC<{prefix: string}> = ({prefix}) => (
    <>
        <Form.Item label="Label" name="name" rules={[{required: true}]}>
            <Input data-testid={`${prefix}-name-input`}/>
        </Form.Item>
        <Form.Item label="Line 1" name="line1" rules={[{required: true}]}>
            <Input data-testid={`${prefix}-line1-input`}/>
        </Form.Item>
        <Form.Item label="Line 2" name="line2">
            <Input data-testid={`${prefix}-line2-input`}/>
        </Form.Item>
        <Form.Item label="City" name="city" rules={[{required: true}]}>
            <Input data-testid={`${prefix}-city-input`}/>
        </Form.Item>
        <Form.Item label="Postal code" name="postalCode" rules={[{required: true}]}>
            <Input data-testid={`${prefix}-postal-input`}/>
        </Form.Item>
        <Form.Item label="Country" name="country" rules={[{required: true}]}>
            <Input data-testid={`${prefix}-country-input`}/>
        </Form.Item>
        <Form.Item label="Set as default" name="isDefault" valuePropName="checked">
            <Switch data-testid={`${prefix}-default-switch`}/>
        </Form.Item>
    </>
);

export const AddressesForm: React.FC<{me: IUser; onMutated: () => void}> = ({me, onMutated}) => {
    const [adding, setAdding] = useState(false);
    const [form] = Form.useForm();
    const list = me.shippingAddresses ?? [];
    const isCompany = me.customerType === 'company';

    const onAdd = async (values: Omit<IAddress, 'id'>) => {
        try {
            await mcpCall('customer.addresses.add', {userId: me.id, address: values});
            toast.success('Address added');
            setAdding(false);
            form.resetFields();
            onMutated();
        } catch (e) {
            toast.error(`Add failed: ${(e as Error).message}`);
        }
    };

    const onDelete = async (addressId: string) => {
        try {
            await mcpCall('customer.addresses.delete', {userId: me.id, addressId});
            toast.success('Removed');
            onMutated();
        } catch (e) {
            toast.error(`Delete failed: ${(e as Error).message}`);
        }
    };

    const onSetDefault = async (addressId: string) => {
        try {
            await mcpCall('customer.addresses.setDefault', {userId: me.id, addressId});
            toast.success('Default updated');
            onMutated();
        } catch (e) {
            toast.error(`Update failed: ${(e as Error).message}`);
        }
    };

    return (
        <div data-testid="addresses-form">
            {isCompany && (
                <Alert
                    type="info"
                    message="Company billing address lives on Profile → Company. Shipping addresses below apply to deliveries."
                    style={{marginBottom: 12}}
                    data-testid="addresses-company-hint"
                />
            )}
            <List
                bordered
                dataSource={list}
                locale={{emptyText: 'No saved addresses'}}
                renderItem={a => (
                    <List.Item
                        data-testid={`address-row-${a.id}`}
                        actions={[
                            a.isDefault ? <Tag color="green" key="def" data-testid={`address-default-${a.id}`}>Default</Tag>
                                : <Button key="set" size="small" onClick={() => void onSetDefault(a.id)} data-testid={`address-setdefault-${a.id}`}>Set default</Button>,
                            <Button key="del" size="small" danger onClick={() => void onDelete(a.id)} data-testid={`address-delete-${a.id}`}>Delete</Button>,
                        ]}
                    >
                        <List.Item.Meta title={a.name} description={`${a.line1}${a.line2 ? ', ' + a.line2 : ''}, ${a.postalCode} ${a.city}, ${a.country}`}/>
                    </List.Item>
                )}
            />
            <Button type="primary" style={{marginTop: 12}} onClick={() => setAdding(true)} data-testid="address-add-btn">Add address</Button>
            <Modal open={adding} onCancel={() => setAdding(false)} footer={null} title="Add address" destroyOnClose>
                <Form form={form} layout="vertical" onFinish={onAdd}>
                    <AddressFields prefix="address-new"/>
                    <Button type="primary" htmlType="submit" data-testid="address-new-save-btn">Save</Button>
                </Form>
            </Modal>
        </div>
    );
};

export default AddressesForm;
