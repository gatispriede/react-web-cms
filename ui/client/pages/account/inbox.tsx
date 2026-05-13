/**
 * Polish bundle (W8f follow-up) — customer-facing in-app inbox.
 *
 * Reads from `NotificationsService.listInbox(userId)` via the existing
 * `myInbox` GraphQL query. Supports mark-read + per-row dismiss
 * (client-side hide; the underlying row keeps its 180-day TTL).
 *
 * Why no "delete" mutation server-side: hard-deleting an inbox row
 * removes the audit trail of what we delivered. The existing TTL
 * (180 days, set by NotificationsService.ensureInboxIndexes) reclaims
 * disk; the customer's "dismiss" gesture is rendered as mark-read +
 * hide-from-list rather than a destructive delete.
 */
import React, {useEffect, useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {Alert, Badge, Button, Card, Empty, List, Spin, Tag, Typography} from 'antd';
import {requireCustomerSession} from '@client/lib/account/session';
import {gql} from '@client/lib/account/gqlClient';
import type {INotification} from '@interfaces/INotification';

const {Title, Text, Paragraph} = Typography;

const CATEGORY_LABEL: Record<string, string> = {
    transactional: 'Order',
    'order-update': 'Order update',
    marketing: 'Promo',
    'inquiry-reply': 'Inquiry reply',
    'low-stock': 'In stock',
    'comment-reply': 'Reply',
};

function categoryColor(c: string): string {
    switch (c) {
        case 'transactional':
        case 'order-update':
            return 'blue';
        case 'marketing':
            return 'purple';
        case 'low-stock':
            return 'green';
        default:
            return 'default';
    }
}

const InboxPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<INotification[]>([]);
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const [msg, setMsg] = useState<{type: 'success' | 'error'; text: string} | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = async (): Promise<void> => {
        setLoading(true);
        try {
            const data = await gql(`query Inbox { mongo { myInbox } }`);
            const raw = data?.mongo?.myInbox;
            if (typeof raw === 'string') {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) setItems(parsed as INotification[]);
                } catch { /* ignore */ }
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const markRead = async (id: string): Promise<void> => {
        setBusy(id);
        try {
            const data = await gql(
                `mutation Read($id: String!) { mongo { markInboxNotificationRead(id: $id) } }`,
                {id},
            );
            const raw = data?.mongo?.markInboxNotificationRead;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed?.error) {
                setMsg({type: 'error', text: parsed.error});
            } else {
                setItems(prev => prev.map(n => (n.id === id ? {...n, readAt: new Date().toISOString()} : n)));
            }
        } catch (e) {
            setMsg({type: 'error', text: (e as Error)?.message ?? 'Could not mark read'});
        } finally {
            setBusy(null);
        }
    };

    const dismiss = (id: string): void => {
        setHidden(prev => new Set(prev).add(id));
    };

    const visible = items.filter(n => !hidden.has(n.id));
    const unread = visible.filter(n => !n.readAt).length;

    if (loading) {
        return <div style={{maxWidth: 720, margin: '40px auto', padding: 16}}><Spin/></div>;
    }

    return (
        <div style={{maxWidth: 720, margin: '40px auto', padding: 16}} data-testid="account-inbox-page">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                <Title level={2} style={{margin: 0}}>
                    Inbox{' '}
                    <Badge count={unread} data-testid="inbox-unread-count" style={{backgroundColor: '#1677ff'}}/>
                </Title>
                <Link href="/account" data-testid="inbox-back-link">Back</Link>
            </div>
            {msg && <Alert style={{marginBottom: 16}} type={msg.type} showIcon message={msg.text}/>}

            {visible.length === 0 ? (
                <Card>
                    <Empty
                        description="No notifications yet"
                        data-testid="inbox-empty"
                    />
                </Card>
            ) : (
                <List
                    data-testid="inbox-list"
                    dataSource={visible}
                    rowKey={n => n.id}
                    renderItem={(n) => (
                        <List.Item
                            data-testid={`inbox-row-${n.id}`}
                            style={{
                                background: n.readAt ? '#fafafa' : '#fff',
                                border: '1px solid #eee',
                                borderRadius: 8,
                                padding: 16,
                                marginBottom: 8,
                            }}
                            actions={[
                                !n.readAt && (
                                    <Button
                                        key="read"
                                        size="small"
                                        loading={busy === n.id}
                                        onClick={() => void markRead(n.id)}
                                        data-testid={`inbox-mark-read-${n.id}`}
                                    >Mark read</Button>
                                ),
                                <Button
                                    key="dismiss"
                                    size="small"
                                    type="text"
                                    onClick={() => dismiss(n.id)}
                                    data-testid={`inbox-dismiss-${n.id}`}
                                >Dismiss</Button>,
                            ].filter(Boolean) as React.ReactNode[]}
                        >
                            <List.Item.Meta
                                title={
                                    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                                        <Tag color={categoryColor(n.category)} data-testid={`inbox-category-${n.id}`}>
                                            {CATEGORY_LABEL[n.category] ?? n.category}
                                        </Tag>
                                        <span>{n.title}</span>
                                        {!n.readAt && <Badge status="processing" data-testid={`inbox-unread-${n.id}`}/>}
                                    </div>
                                }
                                description={
                                    <div>
                                        <Paragraph
                                            style={{margin: '4px 0 8px 0'}}
                                            ellipsis={{rows: 3}}
                                        >
                                            {n.body}
                                        </Paragraph>
                                        <Text type="secondary" style={{fontSize: 12}}>
                                            {new Date(n.createdAt).toLocaleString()}
                                        </Text>
                                        {n.actionUrl && (
                                            <div style={{marginTop: 8}}>
                                                <Link
                                                    href={n.actionUrl}
                                                    data-testid={`inbox-action-${n.id}`}
                                                >
                                                    {n.actionLabel ?? 'Open'}
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const guard = await requireCustomerSession(ctx);
    if (!guard.ok) return {redirect: guard.redirect};
    return {props: {session: guard.session}};
};

export default InboxPage;
