import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Alert, Badge, Button, Card, Empty, Modal, Popconfirm, Space, Table, Tag, Typography, message} from "antd";
import {DeleteOutlined, MailOutlined, ReloadOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import {useRefreshView} from "@client/lib/refreshBus";

/**
 * Admin "Inquiries" tab — surfaces every row in the Mongo `Inquiries`
 * collection (audit log of public-site contact-form submissions).
 *
 * Each row carries the full payload (name / email / topic / message / IP
 * / user-agent) plus a `mail` sub-document recording whether the SMTP
 * delivery to the configured recipient succeeded. If `mail.ok === false`
 * the operator can still recover the message from this view, even when
 * SMTP is misconfigured or down.
 *
 * Read-only with one mutating action — DELETE. Refresh polls the
 * settings refresh bus so admins on multiple devices see new
 * submissions when others delete or when the bundle reloads.
 */

interface InquirySummary {
    id: string;
    createdAt: string;
    name: string;
    email: string;
    topic?: string;
    preview: string;
    recipient: string;
    ip: string;
    mail?: {ok?: boolean; error?: string; messageId?: string} | null;
}

interface InquiryFull extends InquirySummary {
    message: string;
    userAgent?: string;
}

const fetchList = async (): Promise<InquirySummary[]> => {
    const res = await fetch('/api/inquiries', {credentials: 'same-origin'});
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.rows) ? data.rows : [];
};

const fetchOne = async (id: string): Promise<InquiryFull> => {
    const res = await fetch(`/api/inquiries?id=${encodeURIComponent(id)}`, {
        credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
};

const deleteOne = async (id: string): Promise<void> => {
    const res = await fetch(`/api/inquiries?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
};

const deleteAll = async (): Promise<number> => {
    const res = await fetch(`/api/inquiries?all=true`, {
        method: 'DELETE',
        credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`Delete all failed: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    return Number(data?.deleted ?? 0);
};

const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
};

const AdminSettingsInquiries: React.FC = () => {
    const {t} = useTranslation();
    const [rows, setRows] = useState<InquirySummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [openDoc, setOpenDoc] = useState<InquiryFull | null>(null);
    const [openLoading, setOpenLoading] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setRows(await fetchList());
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);
    useRefreshView(refresh, 'settings');

    const openDetail = useCallback(async (id: string) => {
        setOpenId(id);
        setOpenLoading(true);
        try {
            setOpenDoc(await fetchOne(id));
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
            setOpenId(null);
        } finally {
            setOpenLoading(false);
        }
    }, []);

    const closeDetail = () => {
        setOpenId(null);
        setOpenDoc(null);
    };

    const remove = async (id: string) => {
        try {
            await deleteOne(id);
            message.success(t('Inquiry deleted'));
            await refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        }
    };

    const removeAll = async () => {
        try {
            const deleted = await deleteAll();
            message.success(t('Deleted {{n}} inquiries', {n: deleted}));
            await refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        }
    };

    const columns = useMemo(() => [
        {
            title: t('Received'),
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            render: (v: string) => (
                <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>
            ),
        },
        {
            title: t('From'),
            key: 'from',
            render: (_: unknown, r: InquirySummary) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{r.name || '—'}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: 12}}>{r.email}</Typography.Text>
                </Space>
            ),
        },
        {
            title: t('Topic'),
            dataIndex: 'topic',
            key: 'topic',
            width: 140,
            render: (v: string) => (v ? <Tag>{v}</Tag> : <Typography.Text type="secondary">—</Typography.Text>),
        },
        {
            title: t('Preview'),
            dataIndex: 'preview',
            key: 'preview',
            ellipsis: true,
            render: (v: string) => (
                <Typography.Text type="secondary" style={{fontSize: 12}}>{v}</Typography.Text>
            ),
        },
        {
            title: t('Delivery'),
            key: 'mail',
            width: 130,
            render: (_: unknown, r: InquirySummary) => {
                if (!r.mail) return <Tag>{t('No SMTP')}</Tag>;
                if (r.mail.ok) return <Tag color="green">{t('Sent')}</Tag>;
                return <Tag color="red">{t('Failed')}</Tag>;
            },
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 180,
            render: (_: unknown, r: InquirySummary) => (
                <Space size={4}>
                    <Button size="small" icon={<MailOutlined/>} onClick={() => openDetail(r.id)}>
                        {t('View')}
                    </Button>
                    <Popconfirm
                        title={t('Delete inquiry?')}
                        description={t('Removes the audit row. This cannot be undone.')}
                        okText={t('Delete')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                        onConfirm={() => remove(r.id)}
                    >
                        <Button size="small" danger icon={<DeleteOutlined/>}/>
                    </Popconfirm>
                </Space>
            ),
        },
    ], [t, openDetail]);

    const failedCount = rows.filter(r => r.mail && r.mail.ok === false).length;

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 12, width: '100%', justifyContent: 'space-between'}}>
                <Space>
                    <Typography.Title level={4} style={{margin: 0}}>{t('Inquiries')}</Typography.Title>
                    <Badge count={rows.length} showZero color="#5e554b"/>
                </Space>
                <Space>
                    <Button icon={<ReloadOutlined/>} loading={loading} onClick={refresh}>
                        {t('Refresh')}
                    </Button>
                    <Popconfirm
                        title={t('Delete ALL inquiries?')}
                        description={t('Permanently removes every audit row. This cannot be undone.')}
                        okText={t('Delete all')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                        disabled={rows.length === 0}
                        onConfirm={removeAll}
                    >
                        <Button danger icon={<DeleteOutlined/>} disabled={rows.length === 0}>
                            {t('Delete all')}
                        </Button>
                    </Popconfirm>
                </Space>
            </Space>

            {failedCount > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    style={{marginBottom: 12}}
                    message={t('{{n}} inquiry/inquiries failed to deliver via SMTP', {n: failedCount})}
                    description={t('Check SMTP_HOST / SMTP_PASS env or the secret files. Messages are still in this list — open a row to read.')}
                />
            )}

            {rows.length === 0 && !loading ? (
                <Card>
                    <Empty description={t('No inquiries yet. Submissions from the public contact form will land here.')}/>
                </Card>
            ) : (
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={rows}
                    columns={columns}
                    pagination={{pageSize: 25}}
                    size="middle"
                />
            )}

            <Modal
                title={t('Inquiry')}
                open={openId !== null}
                onCancel={closeDetail}
                footer={[
                    <Button key="close" onClick={closeDetail}>{t('Close')}</Button>,
                    openDoc && (
                        <Button
                            key="reply"
                            type="primary"
                            icon={<MailOutlined/>}
                            href={`mailto:${encodeURIComponent(openDoc.email)}?subject=${encodeURIComponent(`Re: ${openDoc.topic ?? 'your inquiry'}`)}`}
                        >
                            {t('Reply')}
                        </Button>
                    ),
                ]}
                width={720}
            >
                {openLoading && <Typography.Text type="secondary">{t('Loading…')}</Typography.Text>}
                {openDoc && (
                    <div>
                        <Space orientation="vertical" size={4} style={{width: '100%', marginBottom: 12}}>
                            <Typography.Text strong>{openDoc.name}</Typography.Text>
                            <Typography.Text>
                                <a href={`mailto:${openDoc.email}`}>{openDoc.email}</a>
                            </Typography.Text>
                            <Typography.Text type="secondary" style={{fontSize: 12}}>
                                {formatDate(openDoc.createdAt)} · IP {openDoc.ip}
                            </Typography.Text>
                            {openDoc.topic && (
                                <div><Tag>{openDoc.topic}</Tag></div>
                            )}
                        </Space>
                        <Card type="inner" style={{marginBottom: 12}}>
                            <Typography.Paragraph
                                style={{whiteSpace: 'pre-wrap', margin: 0}}
                            >
                                {openDoc.message}
                            </Typography.Paragraph>
                        </Card>
                        <div style={{fontSize: 12, color: '#666'}}>
                            <div>{t('Recipient')}: {openDoc.recipient}</div>
                            {openDoc.mail?.ok && openDoc.mail.messageId && (
                                <div>{t('Sent')} · message-id: <code>{openDoc.mail.messageId}</code></div>
                            )}
                            {openDoc.mail && openDoc.mail.ok === false && (
                                <Alert
                                    type="error"
                                    showIcon
                                    style={{marginTop: 6}}
                                    message={t('SMTP delivery failed')}
                                    description={<code>{openDoc.mail.error}</code>}
                                />
                            )}
                            {openDoc.userAgent && (
                                <div style={{marginTop: 6, opacity: 0.7}}>
                                    UA: <code style={{fontSize: 11}}>{openDoc.userAgent}</code>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AdminSettingsInquiries;
