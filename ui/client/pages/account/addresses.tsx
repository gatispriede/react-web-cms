import React, {useEffect, useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {Alert, Button, Card, Checkbox, Form, Input, List, Modal, Spin, Tag, Typography} from 'antd';
import {requireCustomerSession} from '@client/lib/account/session';
import {gql, parseEnvelope} from '@client/lib/account/gqlClient';

const {Title} = Typography;

interface Address {
    id: string;
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    isDefault?: boolean;
}

const AddressesPage = () => {
    const [loading, setLoading] = useState(true);
    const [list, setList] = useState<Address[]>([]);
    const [editing, setEditing] = useState<Address | null>(null);
    const [open, setOpen] = useState(false);
    const [form] = Form.useForm();
    const [error, setError] = useState<string | null>(null);

    const reload = () =>
        gql(`query Me { mongo { me { shippingAddresses { id name line1 line2 city postalCode country isDefault } } } }`)
            .then(d => setList(d?.mongo?.me?.shippingAddresses ?? []))
            .finally(() => setLoading(false));

    useEffect(() => { reload(); }, []);

    const openNew = () => { setEditing(null); form.resetFields(); setOpen(true); };
    const openEdit = (a: Address) => { setEditing(a); form.setFieldsValue(a); setOpen(true); };

    const save = async (values: any) => {
        setError(null);
        const address = editing ? {...values, id: editing.id} : values;
        const data = await gql(
            `mutation Save($address: InAddress!) { mongo { saveMyAddress(address: $address) } }`,
            {address},
        );
        const env = parseEnvelope(data?.mongo?.saveMyAddress);
        if (env.error) { setError(env.error); return; }
        setOpen(false);
        await reload();
    };

    const remove = async (id: string) => {
        const data = await gql(
            `mutation Del($id: String!) { mongo { deleteMyAddress(id: $id) } }`,
            {id},
        );
        const env = parseEnvelope(data?.mongo?.deleteMyAddress);
        if (env.error) { setError(env.error); return; }
        await reload();
    };

    return (
        <div style={{maxWidth: 720, margin: '40px auto', padding: 16}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Title level={2}>Shipping addresses</Title>
                <Link href="/account">Back</Link>
            </div>
            <Card extra={<Button type="primary" onClick={openNew}>Add address</Button>}>
                {error && <Alert style={{marginBottom: 12}} type="error" showIcon message={error}/>}
                {loading ? <Spin/> : (
                    <List
                        dataSource={list}
                        locale={{emptyText: 'No saved addresses yet.'}}
                        renderItem={a => (
                            <List.Item
                                actions={[
                                    <a key="e" onClick={() => openEdit(a)}>Edit</a>,
                                    <a key="d" onClick={() => remove(a.id)}>Delete</a>,
                                ]}
                            >
                                <List.Item.Meta
                                    title={<>{a.name} {a.isDefault && <Tag color="blue">default</Tag>}</>}
                                    description={`${a.line1}${a.line2 ? ', ' + a.line2 : ''}, ${a.city}, ${a.postalCode}, ${a.country}`}
                                />
                            </List.Item>
                        )}
                    />
                )}
            </Card>
            <Modal
                open={open}
                onCancel={() => setOpen(false)}
                onOk={() => form.submit()}
                title={editing ? 'Edit address' : 'New address'}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={save}>
                    <Form.Item label="Label" name="name" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item label="Line 1" name="line1" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item label="Line 2" name="line2"><Input/></Form.Item>
                    <Form.Item label="City" name="city" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item label="Postal code" name="postalCode" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item label="Country" name="country" rules={[{required: true}]}><Input/></Form.Item>
                    <Form.Item name="isDefault" valuePropName="checked"><Checkbox>Set as default</Checkbox></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {session: guard.session}};
};

export default AddressesPage;
