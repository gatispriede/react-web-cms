import React, {useEffect, useMemo} from "react";
import {Alert, Badge, Button, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography} from "antd";
import {ReloadOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import type {IInventoryRun} from "@interfaces/IInventory";
import type {IProduct} from "@interfaces/IProduct";
import AuditBadge from "@admin/shell/AuditBadge";
import {useViewModel} from "@client/lib/state/observable";
import EmptyState from "@admin/lib/EmptyState";
import {InventoryViewModel} from "./InventoryViewModel";

/** Render-only Inventory pane — VM3 (2026-05-02). */

const statusColor = (s?: string): 'success' | 'processing' | 'warning' | 'error' | 'default' => {
    switch (s) {
        case 'succeeded': return 'success';
        case 'running': return 'processing';
        case 'partial': return 'warning';
        case 'failed': return 'error';
        default: return 'default';
    }
};

const AdminSettingsInventory: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new InventoryViewModel(undefined, t));

    useEffect(() => { void vm.refreshStatus(); void vm.refreshProducts(); }, [vm]);

    const stockColumns = useMemo(() => [
        {title: t('Product'), key: 'p',
            render: (_: unknown, p: IProduct) => (
                <Space direction="vertical" size={0}>
                    <Typography.Text strong>{p.title}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: '.85em'}}>/products/{p.slug}</Typography.Text>
                </Space>
            )},
        {title: t('Stock'), key: 'stock', width: 160,
            render: (_: unknown, p: IProduct) => (
                <InputNumber
                    min={0}
                    data-testid={`admin-inventory-stock-input-${p.slug}`}
                    value={vm.stockDrafts[p.slug] ?? (typeof p.stock === 'number' ? p.stock : 0)}
                    onChange={v => vm.setStockDraft(p.slug, Number(v ?? 0))}
                />
            )},
        {title: t('Last edited'), key: 'audit', width: 200,
            render: (_: unknown, p: IProduct) => (
                <Space size={6}>
                    <AuditBadge editedBy={p.editedBy} editedAt={p.editedAt ?? p.updatedAt} compact/>
                    {vm.lastSavedSlug === p.slug && (
                        <Tag color="green" data-testid={`admin-inventory-just-saved-${p.slug}`}>{t('Updated by you')}</Tag>
                    )}
                </Space>
            )},
        {title: t('Actions'), key: 'a', width: 120,
            render: (_: unknown, p: IProduct) => (
                <Button
                    type="primary"
                    size="small"
                    data-testid={`admin-inventory-save-btn-${p.slug}`}
                    loading={vm.isPendingSave(p.slug)}
                    onClick={() => vm.saveProductStock(p.slug, vm.stockDrafts[p.slug] ?? (typeof p.stock === 'number' ? p.stock : 0))}
                >{t('Save')}</Button>
            )},
    ], [t, vm]);

    const runColumns = useMemo(() => [
        {title: t('Kind'), dataIndex: 'kind', key: 'kind', width: 90},
        {title: t('Started'), dataIndex: 'startedAt', key: 'startedAt', width: 200},
        {title: t('Duration'), key: 'dur', width: 120,
            render: (_: unknown, r: IInventoryRun) => {
                if (!r.finishedAt) return '—';
                const ms = new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime();
                return `${Math.round(ms / 100) / 10}s`;
            }},
        {title: t('Items'), key: 'items', width: 200,
            render: (_: unknown, r: IInventoryRun) =>
                `${r.itemsCreated || 0}+ / ${r.itemsUpdated || 0}~ / ${r.itemsArchived || 0}× / ${(r.errors?.length || 0)}!`},
        {title: t('Status'), dataIndex: 'status', key: 'status', width: 110,
            render: (s: string) => <Tag color={statusColor(s)}>{s}</Tag>},
        {title: t('Actions'), key: 'a',
            render: (_: unknown, r: IInventoryRun) => (
                <Button data-testid={`inventory-row-${r.id}-errors-button`} size="small" onClick={() => vm.setErrorDrawer(r)} disabled={!r.errors?.length}>
                    {t('Errors')} ({r.errors?.length || 0})
                </Button>
            )},
    ], [t, vm]);

    return (
        <div style={{padding: 16}}>
            <Space wrap style={{marginBottom: 16}}>
                <Typography.Title level={4} style={{margin: 0}}>{t('Inventory')}</Typography.Title>
                <Tag color="blue">{vm.status?.adapterId ?? '—'}</Tag>
                {vm.status?.healthOk
                    ? <Badge status="success" text={t('Healthy')}/>
                    : <Badge status="error" text={vm.status?.healthMessage || t('Unreachable')}/>}
                {vm.status?.lastSuccessfulRun?.startedAt
                    ? <Typography.Text type="secondary">{t('Last sync')}: {vm.status.lastSuccessfulRun.startedAt}</Typography.Text>
                    : <Typography.Text type="secondary">{t('No successful sync yet')}</Typography.Text>}
                <Button data-testid="inventory-status-refresh-button" icon={<ReloadOutlined/>} onClick={vm.refreshStatus} loading={vm.loadingStatus}>{t('Refresh')}</Button>
            </Space>

            <Space wrap style={{marginBottom: 16}}>
                <Button
                    data-testid="inventory-sync-delta-button"
                    type="primary"
                    onClick={() => vm.runSync('delta')}
                    loading={vm.syncing === 'delta'}
                    disabled={vm.isRunning || !!vm.syncing}
                >{t('Sync delta')}</Button>
                <Popconfirm
                    title={t('Run a full sync? This pages through every warehouse row.')}
                    onConfirm={() => vm.runSync('all')}
                    okText={t('Sync all')}
                    cancelText={t('Cancel')}
                >
                    <Button data-testid="inventory-sync-all-button" loading={vm.syncing === 'all'} disabled={vm.isRunning || !!vm.syncing}>{t('Sync all')}</Button>
                </Popconfirm>
                <Button data-testid="inventory-dead-letters-button" onClick={vm.openDeadLetters}>{t('Show dead letters')}</Button>
            </Space>

            {vm.lastReport && (
                <Alert
                    style={{marginBottom: 16}}
                    type={vm.lastReport.status === 'succeeded' ? 'success' : vm.lastReport.status === 'partial' ? 'warning' : 'error'}
                    message={`${t('Last run')}: ${vm.lastReport.itemsCreated} ${t('created')}, ${vm.lastReport.itemsUpdated} ${t('updated')}, ${vm.lastReport.itemsArchived} ${t('archived')}, ${vm.lastReport.errors.length} ${t('errors')}`}
                />
            )}

            <Space style={{marginBottom: 8}}>
                <Typography.Title level={5} style={{margin: 0}}>{t('Stock by product')}</Typography.Title>
                <Button
                    size="small"
                    icon={<ReloadOutlined/>}
                    data-testid="admin-inventory-stock-refresh-btn"
                    loading={vm.loadingProducts}
                    onClick={() => vm.refreshProducts()}
                >{t('Refresh')}</Button>
            </Space>
            <Table
                rowKey="slug"
                size="small"
                pagination={{pageSize: 10}}
                columns={stockColumns as any}
                dataSource={vm.products}
                loading={vm.loadingProducts}
                style={{marginBottom: 24}}
                data-testid="admin-inventory-stock-table"
            />

            <Typography.Title level={5}>{t('Run log')}</Typography.Title>
            <Table
                rowKey="id"
                size="small"
                pagination={false}
                columns={runColumns as any}
                dataSource={vm.runs}
                style={{marginBottom: 24}}
                locale={{
                    emptyText: (
                        <EmptyState
                            testId="inventory-runs-empty-state"
                            title={t('empty.inventoryRuns.title')}
                            description={t('empty.inventoryRuns.description')}
                        />
                    ),
                }}
            />

            <Typography.Title level={5}>{t('Adapter config')}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{marginBottom: 12}}>
                {t('Secrets are write-only — saved values are redacted on read. Re-enter the credential on every save.')}
            </Typography.Paragraph>
            <Form layout="vertical">
                <Form.Item label={t('Adapter')}>
                    <Select data-testid="inventory-adapter-kind-select" value={vm.kind} onChange={vm.setKind} style={{width: 240}} options={[
                        {value: 'mock', label: 'Mock (dev / tests)'},
                        {value: 'generic-feed', label: 'Generic feed (HTTP URL)'},
                    ]}/>
                </Form.Item>
                {vm.kind === 'generic-feed' && (
                    <>
                        <Form.Item label={t('URL')}>
                            <Input data-testid="inventory-feed-url-input" value={vm.feedUrl} onChange={e => vm.setFeedUrl(e.target.value)} placeholder="https://example.com/products.json"/>
                        </Form.Item>
                        <Form.Item label={t('Auth mode')}>
                            <Select data-testid="inventory-auth-mode-select" value={vm.authMode} onChange={vm.setAuthMode} style={{width: 200}} options={[
                                {value: 'none', label: 'None'},
                                {value: 'bearer', label: 'Bearer token'},
                                {value: 'apiKey', label: 'API key (header)'},
                                {value: 'basic', label: 'Basic (user:pass)'},
                            ]}/>
                        </Form.Item>
                        {vm.authMode !== 'none' && (
                            <Form.Item label={t('Credential (write-only)')}>
                                <Input.Password data-testid="inventory-credential-input" value={vm.credential} onChange={e => vm.setCredential(e.target.value)} placeholder="•••••"/>
                            </Form.Item>
                        )}
                        <Form.Item label={t('Items path (dot-notation, optional)')}>
                            <Input data-testid="inventory-items-path-input" value={vm.itemsPath} onChange={e => vm.setItemsPath(e.target.value)} placeholder="data.products"/>
                        </Form.Item>
                        <Form.Item label={t('Pagination (JSON)')}>
                            <Input.TextArea data-testid="inventory-pagination-json-textarea" value={vm.paginationJson} onChange={e => vm.setPaginationJson(e.target.value)} rows={4}/>
                        </Form.Item>
                        <Form.Item label={t('Field map (JSON)')}>
                            <Input.TextArea data-testid="inventory-field-map-json-textarea" value={vm.fieldMapJson} onChange={e => vm.setFieldMapJson(e.target.value)} rows={9}/>
                        </Form.Item>
                    </>
                )}
                <Button data-testid="inventory-save-config-button" type="primary" loading={vm.savingCfg} onClick={vm.saveConfig}>{t('Save adapter config')}</Button>
            </Form>

            <Drawer
                data-testid="inventory-errors-drawer"
                open={!!vm.errorDrawer}
                onClose={() => vm.setErrorDrawer(null)}
                title={t('Run errors')}
                width={520}
            >
                {vm.errorDrawer?.errors?.length ? (
                    <Table
                        size="small"
                        rowKey={(r, i) => `${r.externalId}-${i}`}
                        pagination={false}
                        dataSource={vm.errorDrawer.errors}
                        columns={[
                            {title: 'externalId', dataIndex: 'externalId', key: 'eid', width: 200},
                            {title: 'reason', dataIndex: 'reason', key: 'r'},
                        ] as any}
                    />
                ) : <Typography.Text type="secondary">{t('No errors recorded.')}</Typography.Text>}
            </Drawer>

            <Modal
                data-testid="inventory-dead-letters-modal"
                open={vm.deadOpen}
                onCancel={() => vm.setDeadOpen(false)}
                onOk={() => vm.setDeadOpen(false)}
                title={t('Dead letters')}
                width={720}
                footer={null}
            >
                <Table
                    size="small"
                    rowKey="externalId"
                    pagination={{pageSize: 20}}
                    dataSource={vm.deadRows}
                    columns={[
                        {title: 'externalId', dataIndex: 'externalId', key: 'eid', width: 200},
                        {title: 'reason', dataIndex: 'reason', key: 'r'},
                        {title: 'lastSeenAt', dataIndex: 'lastSeenAt', key: 'l', width: 200},
                    ] as any}
                />
            </Modal>
        </div>
    );
};

export default AdminSettingsInventory;
