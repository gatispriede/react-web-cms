/**
 * admin-module-composed (Batch 2) — Inquiries bridge.
 *
 * The `AdminLoader` bridge for `system/inquiries`. `InquiriesViewModel`
 * is unchanged ("admin stays mostly same"); the hand-coded list chrome
 * (toolbar + Table + EmptyState) is replaced by `AdminCrudListModule`,
 * and the bespoke detail Modal + the pull-to-refresh wrapper are kept
 * rendered alongside the module.
 *
 * Registered with the `AdminPageRegistry` by `InquiriesAdminLoader`;
 * the shell reaches it via `AdminPageDispatch` (see
 * `InquiriesAdminUILoader`).
 */
import React, {useEffect, useMemo} from "react";
import {Alert, Badge, Button, Card, Modal, Popconfirm, Space, Spin, Tag, Typography} from "antd";
import type {ColumnsType} from "antd/es/table";
import {DeleteOutlined, MailOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import {useRefreshView} from "@client/lib/refreshBus";
import {useViewModel} from "@client/lib/state/observable";
import {usePullToRefresh, PULL_THRESHOLD_PX} from "@admin/lib/usePullToRefresh";
import {useIsMobile} from "@admin/lib/useIsMobile";
import AdminCrudListModule from "@admin/modules/shapes/AdminCrudListModule";
import {InquiriesViewModel, InquirySummary} from "./InquiriesViewModel";

/** Render-only Inquiries pane — VM3 (2026-05-02). */

const formatDate = (iso: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const AdminSettingsInquiries: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new InquiriesViewModel(t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    const columns = useMemo(() => [
        {title: t('Received'), dataIndex: 'createdAt', key: 'createdAt', width: 170,
            render: (v: string) => <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>},
        {title: t('From'), key: 'from',
            render: (_: unknown, r: InquirySummary) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{r.name || '—'}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: 12}}>{r.email}</Typography.Text>
                </Space>
            )},
        {title: t('Topic'), dataIndex: 'topic', key: 'topic', width: 140,
            render: (v: string) => (v ? <Tag>{v}</Tag> : <Typography.Text type="secondary">—</Typography.Text>)},
        {title: t('Preview'), dataIndex: 'preview', key: 'preview', ellipsis: true,
            render: (v: string) => <Typography.Text type="secondary" style={{fontSize: 12}}>{v}</Typography.Text>},
        {title: t('Delivery'), key: 'mail', width: 130,
            render: (_: unknown, r: InquirySummary) => {
                if (!r.mail) return <Tag>{t('No SMTP')}</Tag>;
                if (r.mail.ok) return <Tag color="green">{t('Sent')}</Tag>;
                return <Tag color="red">{t('Failed')}</Tag>;
            }},
        {title: t('Actions'), key: 'actions', width: 180,
            render: (_: unknown, r: InquirySummary) => (
                <Space size={4}>
                    <Button data-testid={`inquiries-row-${r.id}-view-button`} size="small" icon={<MailOutlined/>} onClick={() => vm.openDetail(r.id)}>{t('View')}</Button>
                    <Popconfirm
                        title={t('Delete inquiry?')}
                        description={t('Removes the audit row. This cannot be undone.')}
                        okText={t('Delete')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                        onConfirm={() => vm.remove(r.id)}
                    >
                        <Button data-testid={`inquiries-row-${r.id}-delete-button`} size="small" danger icon={<DeleteOutlined/>}/>
                    </Popconfirm>
                </Space>
            )},
    ], [t, vm]);

    const isMobile = useIsMobile();
    const {ref: pullRef, pulling, distance} = usePullToRefresh(vm.refresh);
    const pullProgress = Math.min(distance / PULL_THRESHOLD_PX, 1);

    const toolbar = (
        <Space>
            <Typography.Title level={4} style={{margin: 0}}>{t('Inquiries')}</Typography.Title>
            <Badge count={vm.rows.length} showZero color="#5e554b"/>
        </Space>
    );

    const headerExtra = (
        <Popconfirm
            title={t('Delete ALL inquiries?')}
            description={t('Permanently removes every audit row. This cannot be undone.')}
            okText={t('Delete all')}
            okButtonProps={{danger: true}}
            cancelText={t('Cancel')}
            disabled={vm.rows.length === 0}
            onConfirm={vm.removeAll}
        >
            <Button data-testid="inquiries-delete-all-button" danger icon={<DeleteOutlined/>} disabled={vm.rows.length === 0}>{t('Delete all')}</Button>
        </Popconfirm>
    );

    return (
        <div
            ref={isMobile ? pullRef : undefined}
            data-testid="inquiries-list-pull-refresh"
            style={{
                overflowY: 'auto',
                maxHeight: isMobile ? '100vh' : undefined,
                transform: pulling ? `translateY(${distance}px)` : undefined,
                transition: pulling ? 'none' : 'transform 200ms ease',
            }}
        >
            {isMobile && pulling && (
                <div
                    aria-hidden="true"
                    style={{
                        position: 'sticky',
                        top: -36,
                        height: 32,
                        marginTop: -32,
                        textAlign: 'center',
                        opacity: pullProgress,
                    }}
                >
                    <Spin size="small"/>
                </div>
            )}

            {vm.failedCount > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    style={{margin: '16px 16px 0'}}
                    message={t('{{n}} inquiry/inquiries failed to deliver via SMTP', {n: vm.failedCount})}
                    description={t('Check SMTP_HOST / SMTP_PASS env or the secret files. Messages are still in this list — open a row to read.')}
                />
            )}

            <AdminCrudListModule
                testId="admin-inquiries"
                columns={columns as unknown as ColumnsType<Record<string, unknown>>}
                rows={vm.rows as unknown as ReadonlyArray<Record<string, unknown>>}
                rowKey="id"
                loading={vm.loading}
                pageSize={25}
                toolbar={toolbar}
                onRefresh={vm.refresh}
                refreshTestId="inquiries-refresh-button"
                headerExtra={headerExtra}
                rowTestId={(row) => `inquiries-row-${(row as unknown as InquirySummary).id}`}
                emptyState={{
                    testId: 'inquiries-empty-state',
                    title: t('empty.inquiries.title'),
                    description: t('empty.inquiries.description'),
                }}
            />

            <Modal
                data-testid="inquiries-detail-modal"
                title={t('Inquiry')}
                open={vm.openId !== null}
                onCancel={vm.closeDetail}
                footer={[
                    <Button data-testid="inquiries-detail-close-button" key="close" onClick={vm.closeDetail}>{t('Close')}</Button>,
                    vm.openDoc && (
                        <Button
                            data-testid="inquiries-detail-reply-button"
                            key="reply"
                            type="primary"
                            icon={<MailOutlined/>}
                            href={`mailto:${encodeURIComponent(vm.openDoc.email)}?subject=${encodeURIComponent(`Re: ${vm.openDoc.topic ?? 'your inquiry'}`)}`}
                        >
                            {t('Reply')}
                        </Button>
                    ),
                ]}
                width={720}
            >
                {vm.openLoading && <Typography.Text type="secondary">{t('Loading…')}</Typography.Text>}
                {vm.openDoc && (
                    <div>
                        <Space orientation="vertical" size={4} style={{width: '100%', marginBottom: 12}}>
                            <Typography.Text strong>{vm.openDoc.name}</Typography.Text>
                            <Typography.Text>
                                <a href={`mailto:${vm.openDoc.email}`}>{vm.openDoc.email}</a>
                            </Typography.Text>
                            <Typography.Text type="secondary" style={{fontSize: 12}}>
                                {formatDate(vm.openDoc.createdAt)} · IP {vm.openDoc.ip}
                            </Typography.Text>
                            {vm.openDoc.topic && <div><Tag>{vm.openDoc.topic}</Tag></div>}
                        </Space>
                        <Card type="inner" style={{marginBottom: 12}}>
                            <Typography.Paragraph style={{whiteSpace: 'pre-wrap', margin: 0}}>
                                {vm.openDoc.message}
                            </Typography.Paragraph>
                        </Card>
                        <div style={{fontSize: 12, color: '#666'}}>
                            <div>{t('Recipient')}: {vm.openDoc.recipient}</div>
                            {vm.openDoc.mail?.ok && vm.openDoc.mail.messageId && (
                                <div>{t('Sent')} · message-id: <code>{vm.openDoc.mail.messageId}</code></div>
                            )}
                            {vm.openDoc.mail && vm.openDoc.mail.ok === false && (
                                <Alert
                                    type="error"
                                    showIcon
                                    style={{marginTop: 6}}
                                    message={t('SMTP delivery failed')}
                                    description={<code>{vm.openDoc.mail.error}</code>}
                                />
                            )}
                            {vm.openDoc.userAgent && (
                                <div style={{marginTop: 6, opacity: 0.7}}>
                                    UA: <code style={{fontSize: 11}}>{vm.openDoc.userAgent}</code>
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
