import React, {useEffect, useMemo, useState} from 'react';
import {Button, Card, DatePicker, Drawer, Modal, Select, Space, Table, Tag, Typography, message} from 'antd';
import {ReloadOutlined} from '@client/lib/icons';
import OrderApi from '@services/api/client/OrderApi';
import type {IOrder, OrderStatus} from '@interfaces/IOrder';

const api = new OrderApi();

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
    const [orders, setOrders] = useState<IOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
    const [dateRange, setDateRange] = useState<[any, any] | null>(null);
    const [detail, setDetail] = useState<IOrder | null>(null);

    const refresh = async () => {
        setLoading(true);
        try {
            const result = await api.adminOrders({
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setOrders(result);
        } finally { setLoading(false); }
    };

    useEffect(() => { void refresh(); }, [statusFilter]);

    const filtered = useMemo(() => {
        if (!dateRange?.[0] || !dateRange?.[1]) return orders;
        const from = dateRange[0].toDate?.().getTime?.() ?? 0;
        const to = dateRange[1].toDate?.().getTime?.() ?? Date.now();
        return orders.filter(o => {
            const t = new Date(o.createdAt).getTime();
            return t >= from && t <= to;
        });
    }, [orders, dateRange]);

    const onTransition = async (next: OrderStatus) => {
        if (!detail) return;
        const result = await api.adminTransitionOrder({orderId: detail.id, next});
        if ((result as any).error) { message.error((result as any).error); return; }
        message.success(`Marked ${next}`);
        setDetail(result as IOrder);
        await refresh();
    };

    const onRefund = async () => {
        if (!detail) return;
        Modal.confirm({
            title: 'Refund whole order?',
            content: `Refund ${formatMoney(detail.total, detail.currency)} for order ${detail.orderNumber}?`,
            okText: 'Refund',
            okButtonProps: {danger: true},
            onOk: async () => {
                const result = await api.adminRefundOrder({orderId: detail.id});
                if ((result as any).error) { message.error((result as any).error); return; }
                message.success('Refunded');
                setDetail(result as IOrder);
                await refresh();
            },
        });
    };

    return (
        <div>
            <Space style={{marginBottom: 16}}>
                <Select
                    style={{width: 160}}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={STATUS_FILTERS.map(f => ({value: f.value, label: f.label}))}
                />
                <DatePicker.RangePicker onChange={(v) => setDateRange(v as any)}/>
                <Button icon={<ReloadOutlined/>} onClick={refresh} loading={loading}>Refresh</Button>
            </Space>
            <Table<IOrder>
                rowKey="id"
                dataSource={filtered}
                loading={loading}
                pagination={{pageSize: 25}}
                columns={[
                    {title: 'Order #', dataIndex: 'orderNumber', render: (n, r) => <a onClick={() => setDetail(r)}>{n || r.id.slice(0, 8)}</a>},
                    {title: 'Customer', dataIndex: 'customerId', render: (v, r) => v ? v.slice(0, 8) : (r.guestEmail ?? 'guest')},
                    {title: 'Total', dataIndex: 'total', render: (v, r) => formatMoney(v, r.currency)},
                    {title: 'Status', dataIndex: 'status', render: v => <Tag color={statusColor(v as OrderStatus)}>{v}</Tag>},
                    {title: 'Created', dataIndex: 'createdAt', render: v => new Date(v).toLocaleString()},
                ]}
            />
            <Drawer
                title={detail ? `Order ${detail.orderNumber}` : ''}
                width={640}
                open={!!detail}
                onClose={() => setDetail(null)}
            >
                {detail && (
                    <>
                        <Card title="Status" style={{marginBottom: 16}}>
                            <Tag color={statusColor(detail.status)}>{detail.status}</Tag>
                            <div style={{marginTop: 16}}>
                                <Space wrap>
                                    {detail.status === 'paid' && <Button onClick={() => onTransition('fulfilling')}>Mark fulfilling</Button>}
                                    {detail.status === 'fulfilling' && <Button onClick={() => onTransition('shipped')}>Mark shipped</Button>}
                                    {detail.status === 'shipped' && <Button onClick={() => onTransition('delivered')}>Mark delivered</Button>}
                                    {detail.status === 'pending' && <Button danger onClick={() => onTransition('cancelled')}>Cancel</Button>}
                                    {(['paid', 'fulfilling', 'shipped', 'delivered'] as OrderStatus[]).includes(detail.status) && (
                                        <Button danger onClick={onRefund}>Refund</Button>
                                    )}
                                </Space>
                            </div>
                        </Card>
                        <Card title="Items" style={{marginBottom: 16}}>
                            {detail.lineItems.map(line => (
                                <div key={`${line.productId}:${line.sku}`} style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <span>{line.title} × {line.quantity}</span>
                                    <span>{formatMoney(line.lineTotal, detail.currency)}</span>
                                </div>
                            ))}
                            <hr/>
                            <div>Subtotal: {formatMoney(detail.subtotal, detail.currency)}</div>
                            <div>Shipping: {formatMoney(detail.shippingTotal, detail.currency)}</div>
                            <div>Tax: {formatMoney(detail.taxTotal, detail.currency)}</div>
                            <div><strong>Total: {formatMoney(detail.total, detail.currency)}</strong></div>
                        </Card>
                        {detail.shippingAddress && (
                            <Card title="Shipping address" style={{marginBottom: 16}}>
                                <div>{detail.shippingAddress.name}</div>
                                <div>{detail.shippingAddress.line1}</div>
                                <div>{detail.shippingAddress.city}, {detail.shippingAddress.region} {detail.shippingAddress.postalCode}</div>
                                <div>{detail.shippingAddress.country}</div>
                            </Card>
                        )}
                        {detail.paymentRef && (
                            <Card title="Payment" style={{marginBottom: 16}}>
                                <div>Provider: {detail.paymentRef.provider}</div>
                                <div>Auth: {detail.paymentRef.authorizationId}</div>
                                <div>Capture: {detail.paymentRef.captureId ?? '—'}</div>
                                <div>Refund: {detail.paymentRef.refundId ?? '—'}</div>
                                <div>Brand/last4: {detail.paymentRef.brand} •••• {detail.paymentRef.last4}</div>
                            </Card>
                        )}
                        <Card title="Status history">
                            {detail.statusHistory.map((entry, i) => (
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
                Showing {filtered.length} order{filtered.length === 1 ? '' : 's'}.
            </Typography.Paragraph>
        </div>
    );
};

export default AdminOrders;
