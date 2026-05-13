/**
 * Phase 1.B-c — checkout customization admin pane.
 *
 * Sections:
 *   1. Flow shape (single-step | multi-step) + require-account toggle
 *   2. Payment providers (Stripe / BankTransfer / CashOnDelivery / PayPal / Klarna)
 *   3. Per-customer-type field config (8 selects)
 *   4. Order summary template + post-purchase redirect
 *   5. Shipping methods CRUD
 *
 * VM4 — no `useState`. Sonner notifyPromise via the VM.
 */
import React, {useEffect} from 'react';
import {Alert, Button, Card, Input, Radio, Select, Skeleton, Space, Switch, Table} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {
    CheckoutCustomizationViewModel,
    type CustomerKind,
    type FieldKey,
    type FieldState,
} from './CheckoutCustomizationViewModel';
import type {IShippingMethod} from '@interfaces/IShippingMethod';

const FIELD_LABELS: Record<FieldKey, string> = {
    phone: 'Phone',
    company: 'Company name',
    vatId: 'VAT id',
    shippingNotes: 'Shipping notes',
};

const FIELD_OPTIONS: {value: FieldState; label: string}[] = [
    {value: 'required', label: 'Required'},
    {value: 'optional', label: 'Optional'},
    {value: 'hidden', label: 'Hidden'},
];

const PROVIDER_LABELS: Record<string, string> = {
    stripe: 'Stripe (card)',
    bankTransfer: 'Bank transfer',
    cashOnDelivery: 'Cash on delivery',
    paypal: 'PayPal (not wired)',
    klarna: 'Klarna (not wired)',
};

const CheckoutCustomizationPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new CheckoutCustomizationViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    if (vm.loading && vm.shippingMethods.length === 0) return <Skeleton active/>;
    if (vm.error) return <Alert type="error" message={vm.error}/>;

    return (
        <div style={{padding: 16, maxWidth: 960}} data-testid="checkout-customization-panel">
            <Space direction="vertical" size={16} style={{width: '100%'}}>

                <Card title={t('Flow') as string} data-testid="checkout-section-flow">
                    <Space direction="vertical" size={12} style={{width: '100%'}}>
                        <div>
                            <strong>{t('Checkout flow shape') as string}</strong>
                            <div style={{marginTop: 8}}>
                                <Radio.Group
                                    data-testid="checkout-flow-radio"
                                    value={vm.state.flow}
                                    onChange={(e) => void vm.setFlow(e.target.value)}
                                >
                                    <Radio value="single-step" data-testid="checkout-flow-single-step">Single-step (recommended)</Radio>
                                    <Radio value="multi-step" data-testid="checkout-flow-multi-step">Multi-step</Radio>
                                </Radio.Group>
                            </div>
                        </div>
                        <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
                            <Switch
                                data-testid="checkout-require-account-switch"
                                checked={vm.state.requireAccount}
                                onChange={(v) => void vm.setRequireAccount(v)}
                            />
                            <span>{t('Require account before checkout') as string}</span>
                        </label>
                    </Space>
                </Card>

                <Card title={t('Payment providers') as string} data-testid="checkout-section-providers">
                    <Space direction="vertical" size={8} style={{width: '100%'}}>
                        {(Object.keys(vm.state.providers) as Array<keyof typeof vm.state.providers>).map((id) => (
                            <label key={id} style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                <Switch
                                    data-testid={`checkout-provider-${id}-switch`}
                                    checked={vm.state.providers[id]}
                                    onChange={(v) => void vm.setProvider(id, v)}
                                />
                                <span>{PROVIDER_LABELS[id] ?? id}</span>
                            </label>
                        ))}
                    </Space>
                </Card>

                <Card title={t('Per-customer-type fields') as string} data-testid="checkout-section-fields">
                    <Space direction="vertical" size={12} style={{width: '100%'}}>
                        {(['client', 'company'] as CustomerKind[]).map((kind) => (
                            <div key={kind}>
                                <strong style={{textTransform: 'capitalize'}}>{kind}</strong>
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8}}>
                                    {(['phone', 'company', 'vatId', 'shippingNotes'] as FieldKey[]).map((field) => (
                                        <label key={field} style={{display: 'flex', alignItems: 'center', gap: 8}}>
                                            <span style={{minWidth: 120}}>{FIELD_LABELS[field]}</span>
                                            <Select
                                                data-testid={`checkout-field-${kind}-${field}-select`}
                                                style={{minWidth: 140}}
                                                value={vm.state.fields[kind][field]}
                                                options={FIELD_OPTIONS}
                                                onChange={(v) => void vm.setFieldState(kind, field, v)}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </Space>
                </Card>

                <Card title={t('Summary + post-purchase') as string} data-testid="checkout-section-summary">
                    <Space direction="vertical" size={12} style={{width: '100%'}}>
                        <div>
                            <strong>{t('Order summary template') as string}</strong>
                            <div style={{marginTop: 8}}>
                                <Radio.Group
                                    data-testid="checkout-order-summary-radio"
                                    value={vm.state.orderSummaryTemplate}
                                    onChange={(e) => void vm.setOrderSummaryTemplate(e.target.value)}
                                >
                                    <Radio value="compact">Compact</Radio>
                                    <Radio value="detailed">Detailed (default)</Radio>
                                </Radio.Group>
                            </div>
                        </div>
                        <div>
                            <strong>{t('Post-purchase redirect') as string}</strong>
                            <div style={{marginTop: 8}}>
                                <Select
                                    data-testid="checkout-post-purchase-select"
                                    style={{minWidth: 240}}
                                    value={vm.state.postPurchaseRedirect}
                                    options={[
                                        {value: 'magic-link-signup', label: 'Magic-link signup prompt (default)'},
                                        {value: 'order-confirmation', label: 'Order confirmation only'},
                                        {value: 'custom-thank-you', label: 'Custom thank-you page'},
                                    ]}
                                    onChange={(v) => void vm.setPostPurchaseRedirect(v)}
                                />
                            </div>
                        </div>
                    </Space>
                </Card>

                <ShippingMethodsTable vm={vm}/>

            </Space>
        </div>
    );
};

const ShippingMethodsTable: React.FC<{vm: CheckoutCustomizationViewModel}> = ({vm}) => {
    const {t} = useTranslation();
    const [name, setName] = React.useState('');
    return (
        <Card title={t('Shipping methods') as string} data-testid="checkout-section-shipping">
            <Space direction="vertical" size={12} style={{width: '100%'}}>
                <Space>
                    <Input
                        data-testid="shipping-method-new-name"
                        placeholder={t('New method name') as string}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <Button
                        data-testid="shipping-method-create-btn"
                        type="primary"
                        onClick={async () => { await vm.createShippingMethod(name); setName(''); }}
                        disabled={!name.trim()}
                    >
                        {t('Create') as string}
                    </Button>
                </Space>
                <Table<IShippingMethod>
                    rowKey="id"
                    dataSource={vm.shippingMethods}
                    pagination={false}
                    data-testid="shipping-methods-table"
                    columns={[
                        {
                            title: '#',
                            dataIndex: 'displayOrder',
                            width: 60,
                        },
                        {
                            title: 'Name',
                            dataIndex: 'name',
                        },
                        {
                            title: 'Type',
                            dataIndex: 'type',
                            width: 140,
                        },
                        {
                            title: 'Active',
                            width: 100,
                            render: (_v, row) => (
                                <Switch
                                    data-testid={`shipping-method-active-${row.id}`}
                                    checked={row.isActive}
                                    onChange={(v) => void vm.updateShippingMethod(row.id, {isActive: v})}
                                />
                            ),
                        },
                        {
                            title: '',
                            width: 100,
                            render: (_v, row) => (
                                <Button
                                    danger
                                    size="small"
                                    data-testid={`shipping-method-delete-${row.id}`}
                                    onClick={() => void vm.deleteShippingMethod(row.id)}
                                >
                                    Delete
                                </Button>
                            ),
                        },
                    ]}
                />
            </Space>
        </Card>
    );
};

export default CheckoutCustomizationPanel;
