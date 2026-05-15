/**
 * all-pages-module-composed — Account batch smart wrappers.
 *
 * The Account modules (`OrdersList`, `OrderDetailModule`, `AddressList`,
 * `NotificationInbox`) ship as pure presentational components — they
 * take rich typed props and do no data fetching. SystemPageDispatch,
 * though, hands every module the `{item}` renderer contract. These thin
 * wrappers bridge the two: parse operator copy from `item.content`,
 * self-fetch the customer GraphQL surface, wire the mutation callbacks,
 * and render the pure module.
 *
 * Pattern mirror of `ui/admin/modules/_CheckoutPageModules/editors.tsx`
 * — one file per page-family, the pure modules stay pristine + tested.
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/router';
import {Alert, Checkbox, Form, Input, Modal} from 'antd';
import type {IItem} from '@interfaces/IItem';
import {gql, parseEnvelope} from '@client/lib/account/gqlClient';
import {formatMoney, myOrder, myOrders} from '@client/lib/checkout/api';
import OrdersList from '@client/modules/OrdersList/OrdersList';
import type {OrderListRow, OrderListStatus} from '@client/modules/OrdersList/OrdersList.types';
import OrderDetailModule from '@client/modules/OrderDetailModule/OrderDetailModule';
import type {OrderAddress, OrderLineItem, OrderStatusHistoryEntry} from '@client/modules/OrderDetailModule/OrderDetailModule.types';
import type {OrderProgressStep} from '@client/modules/OrderProgressTimeline/OrderProgressTimeline.types';
import AddressList from '@client/modules/AddressList/AddressList';
import type {AddressListAddress} from '@client/modules/AddressList/AddressList.types';
import NotificationInbox from '@client/modules/NotificationInbox/NotificationInbox';
import type {NotificationRow} from '@client/modules/NotificationInbox/NotificationInbox.types';

/** Parse the operator-editable copy blob; tolerate malformed strings. */
function parse<T>(raw: string | undefined): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

const wrapStyle: React.CSSProperties = {width: '100%'};

// ── Orders list ──────────────────────────────────────────────────────

interface OrdersListContent {
    title?: string;
    emptyTitle?: string;
    emptyDescription?: string;
}

export const OrdersListHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<OrdersListContent>(item.content);
    const [rows, setRows] = useState<OrderListRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<OrderListStatus>('all');

    useEffect(() => {
        let live = true;
        myOrders(50)
            .then((orders: Array<Record<string, never>>) => {
                if (!live) return;
                setRows((orders ?? []).map((o): OrderListRow => {
                    const order = o as Record<string, unknown>;
                    const lineItems = order.lineItems;
                    return {
                        id: String(order.id ?? ''),
                        orderNumber: String(order.orderNumber ?? String(order.id ?? '').slice(0, 8)),
                        placedAt: String(order.createdAt ?? ''),
                        status: (order.status as OrderListStatus) ?? 'pending',
                        totalFormatted: formatMoney(order.total as number, order.currency as string),
                        itemCount: Array.isArray(lineItems) ? lineItems.length : Number(order.itemCount ?? 0),
                        href: `/account/orders/${String(order.id ?? '')}`,
                    };
                }));
            })
            .catch(() => { if (live) setRows([]); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, []);

    const visible = useMemo(
        () => (status === 'all' ? rows : rows.filter(r => r.status === status)),
        [rows, status],
    );

    return (
        <div className="account-orders-host" style={wrapStyle} data-testid="account-orders-host">
            {c.title ? <h2 className="account-orders-host__title">{c.title}</h2> : null}
            {loading
                ? <p data-testid="account-orders-loading">Loading…</p>
                : (
                    <OrdersList
                        testId="account-orders"
                        orders={visible}
                        activeStatus={status}
                        onStatusChange={setStatus}
                        emptyState={{
                            title: c.emptyTitle ?? 'No orders yet',
                            description: c.emptyDescription,
                            primary: {label: 'Browse products', href: '/products'},
                        }}
                    />
                )}
        </div>
    );
};

// ── Order detail ─────────────────────────────────────────────────────

interface OrderDetailContent {
    /** Optional override for the contact-support link target. */
    supportHref?: string;
}

const PROGRESS_FLOW: Array<{key: string; label: string}> = [
    {key: 'placed', label: 'Placed'},
    {key: 'paid', label: 'Paid'},
    {key: 'shipped', label: 'Shipped'},
    {key: 'delivered', label: 'Delivered'},
];

const STATUS_RANK: Record<string, number> = {
    pending: 0,
    paid: 1,
    fulfilling: 1,
    shipped: 2,
    delivered: 3,
    cancelled: 3,
    refunded: 3,
};

function buildProgressSteps(status: string): OrderProgressStep[] {
    const rank = STATUS_RANK[status] ?? 0;
    return PROGRESS_FLOW.map((s, i) => ({
        key: s.key,
        label: s.label,
        status: i < rank ? 'done' : i === rank ? 'active' : 'pending',
    }));
}

function toOrderAddress(raw: unknown): OrderAddress | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const a = raw as Record<string, unknown>;
    if (!a.name && !a.line1) return undefined;
    return {
        name: String(a.name ?? ''),
        line1: String(a.line1 ?? ''),
        line2: a.line2 ? String(a.line2) : undefined,
        city: String(a.city ?? ''),
        region: a.region ? String(a.region) : undefined,
        postalCode: String(a.postalCode ?? ''),
        country: String(a.country ?? ''),
    };
}

export const OrderDetailHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<OrderDetailContent>(item.content);
    const router = useRouter();
    const id = typeof router.query.id === 'string' ? router.query.id : null;
    const [order, setOrder] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // `router.query.id` is empty during SSR / first hydration tick —
        // stay in the loading state until the param resolves.
        if (!id) return;
        let live = true;
        myOrder(id)
            .then((o: Record<string, unknown> | null) => { if (live) setOrder(o); })
            .catch(() => { if (live) setOrder(null); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [id]);

    if (loading) return <p data-testid="account-order-detail-loading">Loading…</p>;
    if (!order) {
        return (
            <Alert
                type="error"
                showIcon
                data-testid="account-order-detail-missing"
                message="Order not found"
                description="This order is unavailable, or it belongs to a different account."
            />
        );
    }

    const currency = order.currency as string;
    const rawLines = Array.isArray(order.lineItems) ? order.lineItems : [];
    const lineItems: OrderLineItem[] = rawLines.map((raw): OrderLineItem => {
        const l = raw as Record<string, unknown>;
        return {
            sku: String(l.sku ?? l.productId ?? ''),
            title: String(l.title ?? ''),
            quantity: Number(l.quantity ?? 1),
            lineTotalFormatted: formatMoney(l.lineTotal as number, currency),
        };
    });
    const rawHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const statusHistory: OrderStatusHistoryEntry[] = rawHistory.map((raw): OrderStatusHistoryEntry => {
        const e = raw as Record<string, unknown>;
        return {
            status: String(e.status ?? ''),
            at: e.at ? new Date(String(e.at)).toLocaleString() : '',
            note: e.note ? String(e.note) : undefined,
        };
    });

    return (
        <OrderDetailModule
            testId="account-order-detail"
            orderNumber={String(order.orderNumber ?? id ?? '')}
            progressSteps={buildProgressSteps(String(order.status ?? 'pending'))}
            lineItems={lineItems}
            shippingAddress={toOrderAddress(order.shippingAddress)}
            billingAddress={toOrderAddress(order.billingAddress)}
            payment={{
                subtotalFormatted: formatMoney(order.subtotal as number, currency),
                shippingFormatted: formatMoney(order.shippingTotal as number, currency),
                taxFormatted: formatMoney(order.taxTotal as number, currency),
                totalFormatted: formatMoney(order.total as number, currency),
            }}
            statusHistory={statusHistory}
            actions={{
                onContactSupport: () => {
                    window.location.href = c.supportHref ?? '/account/inbox';
                },
            }}
        />
    );
};

// ── Address list ─────────────────────────────────────────────────────

interface AddressListContent {
    title?: string;
    emptyTitle?: string;
    emptyDescription?: string;
}

const ADDRESS_QUERY =
    'query Me { mongo { me { shippingAddresses { id name line1 line2 city postalCode country isDefault } } } }';

export const AddressListHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<AddressListContent>(item.content);
    const [list, setList] = useState<AddressListAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<AddressListAddress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [form] = Form.useForm();

    const reload = useCallback(() =>
        gql(ADDRESS_QUERY)
            .then(d => setList(d?.mongo?.me?.shippingAddresses ?? []))
            .catch(() => setList([]))
            .finally(() => setLoading(false)),
    []);

    useEffect(() => { void reload(); }, [reload]);

    const openNew = useCallback(() => {
        setEditing(null);
        form.resetFields();
        setOpen(true);
    }, [form]);

    const openEdit = useCallback((id: string) => {
        const found = list.find(a => a.id === id) ?? null;
        setEditing(found);
        if (found) form.setFieldsValue(found);
        setOpen(true);
    }, [form, list]);

    const save = useCallback(async (values: Record<string, unknown>) => {
        setError(null);
        const address = editing ? {...values, id: editing.id} : values;
        const data = await gql(
            'mutation Save($address: InAddress!) { mongo { saveMyAddress(address: $address) } }',
            {address},
        );
        const env = parseEnvelope(data?.mongo?.saveMyAddress);
        if (env.error) { setError(env.error); return; }
        setOpen(false);
        await reload();
    }, [editing, reload]);

    const remove = useCallback(async (id: string) => {
        setError(null);
        const data = await gql(
            'mutation Del($id: String!) { mongo { deleteMyAddress(id: $id) } }',
            {id},
        );
        const env = parseEnvelope(data?.mongo?.deleteMyAddress);
        if (env.error) { setError(env.error); return; }
        await reload();
    }, [reload]);

    return (
        <div className="account-addresses-host" style={wrapStyle} data-testid="account-addresses-host">
            {c.title ? <h2 className="account-addresses-host__title">{c.title}</h2> : null}
            {error ? <Alert style={{marginBottom: 12}} type="error" showIcon message={error}/> : null}
            {loading
                ? <p data-testid="account-addresses-loading">Loading…</p>
                : (
                    <AddressList
                        testId="account-addresses"
                        addresses={list}
                        onAdd={openNew}
                        onEdit={openEdit}
                        onDelete={remove}
                        emptyState={{
                            title: c.emptyTitle ?? 'No saved addresses',
                            description: c.emptyDescription,
                        }}
                    />
                )}
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

// ── Notification inbox ───────────────────────────────────────────────

interface NotificationInboxContent {
    emptyTitle?: string;
    emptyDescription?: string;
}

function safeJsonArray(raw: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }
    return [];
}

export const NotificationInboxHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<NotificationInboxContent>(item.content);
    const [items, setItems] = useState<NotificationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [hidden, setHidden] = useState<Set<string>>(new Set());

    useEffect(() => {
        let live = true;
        gql('query Inbox { mongo { myInbox } }')
            .then(data => {
                if (!live) return;
                const rows = safeJsonArray(data?.mongo?.myInbox).map((n): NotificationRow => ({
                    id: String(n.id ?? ''),
                    title: String(n.title ?? ''),
                    body: n.body ? String(n.body) : undefined,
                    createdAt: String(n.createdAt ?? ''),
                    readAt: (n.readAt as string | null | undefined) ?? null,
                    href: n.actionUrl ? String(n.actionUrl) : undefined,
                    category: n.category ? String(n.category) : undefined,
                }));
                setItems(rows);
            })
            .catch(() => { if (live) setItems([]); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, []);

    const markRead = useCallback(async (id: string) => {
        try {
            await gql(
                'mutation Read($id: String!) { mongo { markInboxNotificationRead(id: $id) } }',
                {id},
            );
            setItems(prev => prev.map(n => (n.id === id ? {...n, readAt: new Date().toISOString()} : n)));
        } catch { /* leave row unread — the customer can retry */ }
    }, []);

    const dismiss = useCallback((id: string) => {
        setHidden(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    const visible = useMemo(() => items.filter(n => !hidden.has(n.id)), [items, hidden]);

    if (loading) return <p data-testid="account-inbox-loading">Loading…</p>;

    return (
        <NotificationInbox
            testId="account-inbox"
            notifications={visible}
            onMarkRead={markRead}
            onDelete={dismiss}
            emptyState={{
                title: c.emptyTitle ?? 'Your inbox is empty',
                description: c.emptyDescription,
            }}
        />
    );
};
