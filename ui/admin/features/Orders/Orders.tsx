import React, {useEffect} from 'react';
import {Button, Card, DatePicker, Drawer, Select, Space, Table, Tag, Typography} from 'antd';
import {ReloadOutlined} from '@client/lib/icons';
import type {IOrder, OrderStatus} from '@interfaces/IOrder';
import {useViewModel} from '@client/lib/state/observable';
import {OrdersViewModel} from './OrdersViewModel';

/** Render-only Orders pane — VM3 (2026-05-02). */

const STATUS_FILTERS: Array<{value: OrderStatus | 'all'; label: string}> = [
    {value: 'all', label: 'All'},
    {value: 'pending', label: 'Pending'},
    {value: 'paid', label: 'Paid'},
    {value: 'fulfilling', label: 'Fulfilling'},
    {value: 'shipped', label: 'Shipped'},
    {value: 'delivered', label: 'Delivered'},
    {value: 'cancelled', label: 'Cancelled'},
    {value: 'refunded', label: 'Refunded'},
];

const formatMoney = (amount: number, currency: string) => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'USD'}).format((amount ?? 0) / 100);
    } catch { return `${(amount ?? 0) / 100} ${currency || ''}`; }
};

const statusColor = (s: OrderStatus): string => {
    switch (s) {
        case 'paid': return 'blue';
        case 'fulfilling': return 'gold';
        case 'shipped': return 'purple';
        case 'delivered': return 'green';
        case 'cancelled': return 'default';
        case 'refunded': return 'red';
        default: return 'default';
    }
};

const AdminOrders: React.FC = () => {
    const vm = useViewModel(() => new OrdersViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    return (
        <div>
            <Space style={{marginBottom: 16}}>
                <Select
                    style={{width: 160}}
                    value={vm.statusFilter}
                    onChange={vm.setStatusFilter}
                    options={STATUS_FILTERS.map(f => ({value: f.value, label: f.label}))}
                />
                <DatePicker.RangePicker onChange={(v) => vm.setDateRange(v as any)}/>
                <Button icon={<ReloadOutlined/>} onClick={vm.refresh} loading={vm.loading}>Refresh</Button>
            </Space>
            <Table<IOrder>
                rowKey="id"
                dataSource={vm.filtered}
                loading={vm.loading}
                pagination={{pageSize: 25}}
                columns={[
                    {title: 'Order #', dataIndex: 'orderNumber', render: (n, r) => <a data-testid={`admin-orders-row-link-${r.id}`} onClick={() => vm.selectDetail(r)}>{n || r.id.slice(0, 8)}</a>},
                    {title: 'Customer', dataIndex: 'customerId', render: (v, r) => v ? v.slice(0, 8) : (r.guestEmail ?? 'guest')},
                    {title: 'Total', dataIndex: 'total', render: (v, r) => formatMoney(v, r.currency)},
                    {title: 'Status', dataIndex: 'status', render: v => <Tag color={statusColor(v as OrderStatus)}>{v}</Tag>},
                    {title: 'Created', dataIndex: 'createdAt', render: v => new Date(v).toLocaleString()},
                ]}
            />
            <Drawer
                title={vm.detail ? `Order ${vm.detail.orderNumber}` : ''}
                width={640}
                open={!!vm.detail}
                onClose={() => vm.selectDetail(null)}
            >
                {vm.detail && (
                    <>
                        <Card title="Status" style={{marginBottom: 16}}>
                            <Tag color={statusColor(vm.detail.status)}>{vm.detail.status}</Tag>
                            <div style={{marginTop: 16}}>
                                <Space wrap>
                                    {vm.detail.status === 'paid' && <Button onClick={() => vm.transition('fulfilling')}>Mark fulfilling</Button>}
                                    {vm.detail.status === 'fulfilling' && <Button onClick={() => vm.transition('shipped')}>Mark shipped</Button>}
                                    {vm.detail.status === 'shipped' && <Button onClick={() => vm.transition('delivered')}>Mark delivered</Button>}
                                    {vm.detail.status === 'pending' && <Button danger onClick={() => vm.transition('cancelled')}>Cancel</Button>}
                                    {(['paid', 'fulfilling', 'shipped', 'delivered'] as OrderStatus[]).includes(vm.detail.status) && (
                                        <Button danger onClick={vm.refund}>Refund</Button>
                                    )}
                                </Space>
                            </div>
                        </Card>
                        <Card title="Items" style={{marginBottom: 16}}>
                            {vm.detail.lineItems.map(line => (
                                <div
                                    key={`${line.productId}:${line.sku}`}
                                    data-testid={`admin-order-detail-line-${line.sku}`}
                                    style={{display: 'flex', justifyContent: 'space-between'}}
                                >
                                    <span>
                                        {line.title} ×{' '}
                                        <span data-testid={`admin-order-detail-line-qty-${line.sku}`}>{line.quantity}</span>
                                    </span>
                                    <span data-testid={`admin-order-detail-line-price-${line.sku}`}>
                                        {formatMoney(line.lineTotal, vm.detail!.currency)}
                                    </span>
                                </div>
                            ))}
                            <hr/>
                            <div>Subtotal: {formatMoney(vm.detail.subtotal, vm.detail.currency)}</div>
                            <div>Shipping: {formatMoney(vm.detail.shippingTotal, vm.detail.currency)}</div>
                            <div>Tax: {formatMoney(vm.detail.taxTotal, vm.detail.currency)}</div>
                            <div><strong>Total: <span data-testid="admin-order-detail-total">{formatMoney(vm.detail.total, vm.detail.currency)}</span></strong></div>
                        </Card>
                        {vm.detail.shippingAddress && (
                            <Card title="Shipping address" style={{marginBottom: 16}}>
                                <div>{vm.detail.shippingAddress.name}</div>
                                <div>{vm.detail.shippingAddress.line1}</div>
                                <div>{vm.detail.shippingAddress.city}, {vm.detail.shippingAddress.region} {vm.detail.shippingAddress.postalCode}</div>
                                <div>{vm.detail.shippingAddress.country}</div>
                            </Card>
                        )}
                        {vm.detail.paymentRef && (
                            <Card title="Payment" style={{marginBottom: 16}}>
                                <div>Provider: {vm.detail.paymentRef.provider}</div>
                                <div>Auth: {vm.detail.paymentRef.authorizationId}</div>
                                <div>Capture: {vm.detail.paymentRef.captureId ?? '—'}</div>
                                <div>Refund: {vm.detail.paymentRef.refundId ?? '—'}</div>
                                <div>Brand/last4: {vm.detail.paymentRef.brand} •••• {vm.detail.paymentRef.last4}</div>
                            </Card>
                        )}
                        <Card title="Status history">
                            {vm.detail.statusHistory.map((entry, i) => (
                                <div key={i}>
                                    <Tag>{entry.status}</Tag>
                                    {new Date(entry.at).toLocaleString()}
                                    {entry.by ? ` by ${entry.by}` : ''}
                                    {entry.note ? ` — ${entry.note}` : ''}
                                </div>
                            ))}
                        </Card>
                    </>
                )}
            </Drawer>
            <Typography.Paragraph type="secondary" style={{marginTop: 24}}>
                Showing {vm.filtered.length} order{vm.filtered.length === 1 ? '' : 's'}.
            </Typography.Paragraph>
        </div>
    );
};

export default AdminOrders;
