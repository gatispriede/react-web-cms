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
import {useParams} from 'next/navigation';
import {Alert, Button, Card, Checkbox, Form, Input, Modal, Spin} from 'antd';
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
import AccountDashboardGrid from '@client/modules/AccountDashboardGrid/AccountDashboardGrid';
import type {AccountDashboardCard} from '@client/modules/AccountDashboardGrid/AccountDashboardGrid.types';

/** Parse the operator-editable copy blob; tolerate malformed strings. */
function parse<T>(raw: string | undefined): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

const wrapStyle: React.CSSProperties = {width: '100%'};

/**
 * Compose the host root className with the operator-picked style
 * variant suffix. SectionContent forwards `item.style` (the lowercase
 * enum value) onto each module's wrapper, but the smart-wrapper hosts
 * historically rendered a fixed `<base>-host` class only — so picking
 * "Cards" / "Receipt" / "Stacked" in the Style dropdown changed
 * nothing visually. This helper appends `<base>-host--<style>` so the
 * per-variant SCSS rules added in the recent style-variant batch
 * actually land. Whitespace-collapsed; missing/`default` style stays
 * a no-op so the original single-class output is preserved.
 */
function hostCx(base: string, item: IItem): string {
    const style = (item.style as string | undefined) ?? '';
    if (!style || style === 'default') return `${base}-host`;
    return `${base}-host ${style}`;
}

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
        <div className={hostCx('account-orders', item)} style={wrapStyle} data-testid="account-orders-host">
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
    // App-Router-compatible param read. `useParams()` works in both routers
    // since Next 13 (the Pages-Router shim returns the same dynamic segment
    // map shape `{id: 'abc'}`). Empty/object-typed during SSR / first
    // hydration tick — same wait-for-resolve pattern as the old
    // `router.query.id` read.
    const params = useParams();
    const rawId = (params as Record<string, string | string[] | undefined> | null)?.id ?? null;
    const id = typeof rawId === 'string' ? rawId : (Array.isArray(rawId) ? (rawId[0] ?? null) : null);
    const [order, setOrder] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // `useParams()` is empty during SSR / first hydration tick —
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

    // Invoice download — only shown once the order has paid + an
    // invoice has been issued. The status gate prevents a "pending"
    // download attempt that would 404; the API endpoint itself
    // re-validates ownership.
    const showInvoice = String(order.status ?? '') !== 'pending'
        && String(order.status ?? '') !== 'cancelled';
    const invoiceUrl = showInvoice
        ? `/api/account/invoice?orderId=${encodeURIComponent(String(id ?? order.id ?? ''))}`
        : undefined;

    return (
        <div className={hostCx('account-order-detail', item)} style={wrapStyle} data-testid="account-order-detail-host">
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
                invoiceDownloadUrl={invoiceUrl}
            />
        </div>
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
        <div className={hostCx('account-addresses', item)} style={wrapStyle} data-testid="account-addresses-host">
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
        <div className={hostCx('account-inbox', item)} style={wrapStyle} data-testid="account-inbox-host">
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
        </div>
    );
};

// ── Account dashboard ────────────────────────────────────────────────
//
// Module-composes `/account` — the last hand-coded customer page. Reads
// the customer's saved-address count + unread-inbox count so the grid
// cards carry meaningful badges; falls back to no badge when either
// query fails (the grid still works, just without counts).

interface AccountDashboardContent {
    /** Optional per-card override map — operators can drop a card by
     *  setting `{<key>: {hidden: true}}` or relabel a card by setting
     *  `{<key>: {label: '…'}}`. Default cards come from
     *  `DEFAULT_CARD_DEFS` in `AccountDashboardGrid.types.ts`. */
    cards?: Partial<Record<string, {hidden?: boolean; label?: string; href?: string}>>;
}

const ACCOUNT_DASHBOARD_QUERY =
    'query Me { mongo { me { shippingAddresses { id } } } }';

const DEFAULT_CARD_ORDER = ['orders', 'addresses', 'searches', 'wishlist', 'payments', 'settings'] as const;
const FALLBACK_LABELS: Record<string, string> = {
    orders: 'Orders',
    addresses: 'Addresses',
    searches: 'Saved searches',
    wishlist: 'Wishlist',
    payments: 'Payment methods',
    settings: 'Settings',
};
const FALLBACK_HREFS: Record<string, string> = {
    orders: '/account/orders',
    addresses: '/account/addresses',
    searches: '/account/searches',
    wishlist: '/account/wishlist',
    payments: '/account/payments',
    settings: '/account/settings',
};

export const AccountDashboardGridHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<AccountDashboardContent>(item.content);
    const [addressCount, setAddressCount] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        gql(ACCOUNT_DASHBOARD_QUERY)
            .then(d => {
                if (cancelled) return;
                const addrs = d?.mongo?.me?.shippingAddresses;
                setAddressCount(Array.isArray(addrs) ? addrs.length : undefined);
            })
            .catch(() => { /* tolerate — render without badges */ })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Counts only attach to cards whose semantics match the available
    // signal — addresses gets the saved-address count; orders /
    // wishlist / etc. stay unbadged until those services expose count
    // queries through the customer GraphQL surface.
    const cards: AccountDashboardCard[] = [];
    for (const key of DEFAULT_CARD_ORDER) {
        const override = c.cards?.[key];
        if (override?.hidden) continue;
        cards.push({
            key,
            label: override?.label ?? FALLBACK_LABELS[key],
            href: override?.href ?? FALLBACK_HREFS[key],
            count: key === 'addresses' ? addressCount : undefined,
        });
    }

    if (loading && addressCount === undefined) {
        return <p data-testid="account-dashboard-loading">Loading…</p>;
    }
    return (
        <div className={hostCx('account-dashboard', item)} style={wrapStyle} data-testid="account-dashboard-host">
            <AccountDashboardGrid testId="account-dashboard" cards={cards}/>
        </div>
    );
};

// ── Account profile + password ───────────────────────────────────────
//
// Module-composes `/account/profile`. Two stacked AntD Cards — personal
// details (name / email / phone) and password change. Identical
// behaviour to the bespoke page it replaces; just authored as a single
// locked smart-wrapper so /account/profile can render through
// SystemPageDispatch.

interface AccountProfileFormContent {
    /** Optional section heading rendered above the personal-details card. */
    headline?: string;
    /** Override the personal-details card title (default: 'Personal details'). */
    profileCardTitle?: string;
    /** Override the password card title (default: 'Change password'). */
    passwordCardTitle?: string;
    /** Optional success message after a profile save. */
    successMessage?: string;
}

export const AccountProfileFormHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<AccountProfileFormContent>(item.content);
    const [loading, setLoading] = useState(true);
    const [profileForm] = Form.useForm();
    const [pwForm] = Form.useForm();
    const [profileMsg, setProfileMsg] = useState<{type: 'success' | 'error'; text: string} | null>(null);
    const [pwMsg, setPwMsg] = useState<{type: 'success' | 'error'; text: string} | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPw, setSavingPw] = useState(false);

    useEffect(() => {
        let cancelled = false;
        gql('query Me { mongo { me { name email phone } } }')
            .then(d => {
                if (cancelled) return;
                const me = d?.mongo?.me;
                if (me) profileForm.setFieldsValue(me);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [profileForm]);

    const saveProfile = useCallback(async (values: {name?: string; email?: string; phone?: string}) => {
        setSavingProfile(true);
        setProfileMsg(null);
        try {
            const data = await gql(
                'mutation Update($customer: InUser!) { mongo { updateMyProfile(customer: $customer) } }',
                {customer: values},
            );
            const env = parseEnvelope(data?.mongo?.updateMyProfile);
            if (env.error) setProfileMsg({type: 'error', text: env.error});
            else setProfileMsg({type: 'success', text: c.successMessage ?? 'Profile updated'});
        } catch (e: any) {
            setProfileMsg({type: 'error', text: e?.message || 'Update failed'});
        } finally {
            setSavingProfile(false);
        }
    }, [c.successMessage]);

    const changePassword = useCallback(async (values: {oldPassword: string; newPassword: string}) => {
        setSavingPw(true);
        setPwMsg(null);
        try {
            const data = await gql(
                'mutation Pw($oldPassword: String!, $newPassword: String!) { mongo { changeMyPassword(oldPassword: $oldPassword, newPassword: $newPassword) } }',
                values,
            );
            const env = parseEnvelope(data?.mongo?.changeMyPassword);
            if (env.error) setPwMsg({type: 'error', text: env.error});
            else { setPwMsg({type: 'success', text: 'Password changed'}); pwForm.resetFields(); }
        } catch (e: any) {
            setPwMsg({type: 'error', text: e?.message || 'Change failed'});
        } finally {
            setSavingPw(false);
        }
    }, [pwForm]);

    return (
        <div className={hostCx('account-profile', item)} style={wrapStyle} data-testid="account-profile-host">
            {c.headline ? <h2 className="account-profile-host__title">{c.headline}</h2> : null}
            {loading ? <Spin data-testid="account-profile-loading"/> : (
                <>
                    <Card title={c.profileCardTitle ?? 'Personal details'} style={{marginBottom: 16}} data-testid="account-profile-card">
                        {profileMsg ? <Alert style={{marginBottom: 12}} type={profileMsg.type} showIcon message={profileMsg.text} data-testid={`account-profile-${profileMsg.type}`}/> : null}
                        <Form form={profileForm} layout="vertical" onFinish={saveProfile}>
                            <Form.Item label="Name" name="name"><Input data-testid="account-profile-name"/></Form.Item>
                            <Form.Item label="Email" name="email" rules={[{type: 'email'}]}><Input data-testid="account-profile-email"/></Form.Item>
                            <Form.Item label="Phone" name="phone"><Input data-testid="account-profile-phone"/></Form.Item>
                            <Button type="primary" htmlType="submit" loading={savingProfile} data-testid="account-profile-save">Save</Button>
                        </Form>
                    </Card>
                    <Card title={c.passwordCardTitle ?? 'Change password'} data-testid="account-password-card">
                        {pwMsg ? <Alert style={{marginBottom: 12}} type={pwMsg.type} showIcon message={pwMsg.text} data-testid={`account-password-${pwMsg.type}`}/> : null}
                        <Form form={pwForm} layout="vertical" onFinish={changePassword}>
                            <Form.Item label="Current password" name="oldPassword" rules={[{required: true}]}>
                                <Input.Password autoComplete="current-password" data-testid="account-password-old"/>
                            </Form.Item>
                            <Form.Item label="New password" name="newPassword" rules={[{required: true, min: 8}]}>
                                <Input.Password autoComplete="new-password" data-testid="account-password-new"/>
                            </Form.Item>
                            <Button type="primary" htmlType="submit" loading={savingPw} data-testid="account-password-save">Change password</Button>
                        </Form>
                    </Card>
                </>
            )}
        </div>
    );
};

// ── Account settings (tabbed layout) ─────────────────────────────────
//
// Module-composes `/account/settings`. Unlike the other Account
// wrappers, the settings layout NEEDS server-resolved props: the
// customer profile (`me`), the operator-hidden tab list, and the
// `commerce.accountSettingsEnabled` master switch. Server resolution
// already happens in the page.tsx loader; rather than re-fetch on
// mount (which would flash the unauthenticated state), the smart
// wrapper reads the data off the SystemPageDispatch `pageProps`
// channel introduced in the same commit.
//
// pageProps contract (page-scoped):
//   {
//     me: IUser;
//     activeTab: AccountSettingsTab;
//     hiddenTabs: AccountSettingsTab[];
//     enabled: boolean;
//   }

import {AccountSettingsLayout as AccountSettingsLayoutComponent} from '@client/components/AccountSettings/AccountSettingsLayout';
import type {AccountSettingsTab} from '@client/components/AccountSettings/types';
import type {IUser} from '@interfaces/IUser';

interface AccountSettingsPageProps {
    me?: IUser;
    activeTab?: AccountSettingsTab;
    hiddenTabs?: AccountSettingsTab[];
    enabled?: boolean;
}

interface AccountSettingsLayoutContent {
    /** Copy shown when `commerce.accountSettingsEnabled` is false. */
    disabledMessage?: string;
    /** Copy shown when the smart wrapper is mounted without pageProps
     *  (e.g. operator drops the module on a non-/account/settings page
     *  by mistake). Defaults to a self-explanatory developer-facing
     *  note rather than a customer-facing string. */
    missingDataMessage?: string;
}

export const AccountSettingsLayoutHost: React.FC<{item: IItem; pageProps?: Record<string, unknown>}> = ({item, pageProps}) => {
    const c = parse<AccountSettingsLayoutContent>(item.content);
    const data = (pageProps ?? {}) as AccountSettingsPageProps;

    if (!data.me) {
        // No server data — render a placeholder so misplacement on a
        // non-settings page is obvious to the operator rather than
        // silently dead.
        return (
            <main data-testid="account-settings-no-data" style={{padding: 16, color: 'var(--ink-2)'}}>
                {c.missingDataMessage ?? 'AccountSettingsLayout requires server-resolved pageProps (mount on /account/settings).'}
            </main>
        );
    }
    if (data.enabled === false) {
        return (
            <main data-testid="account-settings-disabled">
                <h1>{c.disabledMessage ?? 'Settings are not available on this site.'}</h1>
            </main>
        );
    }
    return (
        <main className={hostCx('account-settings', item)} data-testid="account-settings-host">
            <AccountSettingsLayoutComponent
                me={data.me}
                activeTab={data.activeTab ?? 'profile'}
                hiddenTabs={data.hiddenTabs ?? []}
            />
        </main>
    );
};
