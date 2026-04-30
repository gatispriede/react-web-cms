import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Alert, Badge, Button, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message} from "antd";
import {ReloadOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import InventoryApi from "@services/api/client/InventoryApi";
import type {
    IAdapterConfig,
    IInventoryDeadLetter,
    IInventoryRun,
    InventoryStatus,
    SyncReport,
} from "@interfaces/IInventory";

/**
 * Admin Inventory pane — orchestrates the warehouse adapter status,
 * manual sync triggers, run log, dead-letter review, and adapter config.
 *
 * Spec: docs/features/inventory-warehouse.md §5. The run log is rendered
 * from the most recent SyncReport plus prior runs returned alongside the
 * status payload (see `InventoryStatus.currentRun` /
 * `lastSuccessfulRun`); a dedicated `listRuns` GraphQL query is the
 * follow-up task once the operator has feedback on what they want.
 *
 * DECISION: field-mapping is rendered as a JSON textarea for v1 (per the
 * scope checklist). The "guided field mapping" UX is deferred to a
 * follow-up — once the operator has run a real source they can tell us
 * what shape the picker should take.
 */

const api = new InventoryApi();

type Section = 'status' | 'config' | 'runs' | 'dead';

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
    const [status, setStatus] = useState<InventoryStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [syncing, setSyncing] = useState<'all' | 'delta' | null>(null);
    const [lastReport, setLastReport] = useState<SyncReport | null>(null);
    const [errorDrawer, setErrorDrawer] = useState<IInventoryRun | null>(null);
    const [deadOpen, setDeadOpen] = useState(false);
    const [deadRows, setDeadRows] = useState<IInventoryDeadLetter[]>([]);

    // Config form state.
    const [kind, setKind] = useState<IAdapterConfig['kind']>('mock');
    const [feedUrl, setFeedUrl] = useState('');
    const [authMode, setAuthMode] = useState<'none' | 'bearer' | 'apiKey' | 'basic'>('none');
    const [credential, setCredential] = useState('');
    const [itemsPath, setItemsPath] = useState('');
    const [paginationJson, setPaginationJson] = useState('{"kind":"none"}');
    const [fieldMapJson, setFieldMapJson] = useState(JSON.stringify({
        externalId: 'id',
        sku: 'sku',
        title: 'title',
        priceCents: 'priceCents',
        currency: 'currency',
        stock: 'stock',
        updatedAt: 'updatedAt',
    }, null, 2));
    const [savingCfg, setSavingCfg] = useState(false);

    const refreshStatus = useCallback(async () => {
        setLoadingStatus(true);
        try {
            const s = await api.status();
            if ((s as {error?: string}).error) {
                message.error((s as {error: string}).error);
                return;
            }
            setStatus(s as InventoryStatus);
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    useEffect(() => { void refreshStatus(); }, [refreshStatus]);

    const refreshDead = useCallback(async () => {
        const rows = await api.readDeadLetters(100);
        setDeadRows(rows);
    }, []);

    const runSync = async (kind: 'all' | 'delta') => {
        setSyncing(kind);
        try {
            const out = kind === 'all' ? await api.syncAll() : await api.syncDelta();
            if ((out as {error?: string}).error) {
                message.error((out as {error: string}).error);
                return;
            }
            setLastReport(out as SyncReport);
            const s = out as SyncReport;
            const summary = `${t('Sync')} ${kind === 'all' ? t('all') : t('delta')}: ${s.itemsCreated} ${t('created')}, ${s.itemsUpdated} ${t('updated')}, ${s.itemsArchived} ${t('archived')}, ${s.errors.length} ${t('errors')}`;
            if (s.status === 'succeeded') message.success(summary);
            else if (s.status === 'partial') message.warning(summary);
            else message.error(summary);
            await refreshStatus();
        } finally {
            setSyncing(null);
        }
    };

    const saveConfig = async () => {
        let pagination: unknown;
        let fieldMap: unknown;
        try { pagination = JSON.parse(paginationJson); }
        catch { message.error(t('Pagination JSON is invalid')); return; }
        try { fieldMap = JSON.parse(fieldMapJson); }
        catch { message.error(t('Field map JSON is invalid')); return; }
        const cfg: IAdapterConfig = kind === 'mock'
            ? {kind: 'mock'}
            : {
                kind: 'generic-feed',
                url: feedUrl,
                ...(authMode !== 'none' ? {authMode} : {}),
                ...(credential ? {credential} : {}),
                ...(itemsPath ? {itemsPath} : {}),
                pagination: pagination as any,
                fieldMap: fieldMap as any,
            };
        setSavingCfg(true);
        try {
            const out = await api.saveAdapterConfig(cfg);
            if (out.error) { message.error(out.error); return; }
            message.success(t('Adapter config saved'));
            // Wipe the credential field locally so it's not lying around in
            // a re-render — the server now redacts on read.
            setCredential('');
            await refreshStatus();
        } finally {
            setSavingCfg(false);
        }
    };

    const runs = useMemo(() => {
        const out: IInventoryRun[] = [];
        if (status?.currentRun) out.push(status.currentRun);
        if (status?.lastSuccessfulRun && status.lastSuccessfulRun.id !== status?.currentRun?.id) {
            out.push(status.lastSuccessfulRun);
        }
        return out;
    }, [status]);

    const runColumns = useMemo(() => [
        {title: t('Kind'), dataIndex: 'kind', key: 'kind', width: 90},
        {title: t('Started'), dataIndex: 'startedAt', key: 'startedAt', width: 200},
        {
            title: t('Duration'),
            key: 'dur',
            width: 120,
            render: (_: unknown, r: IInventoryRun) => {
                if (!r.finishedAt) return '—';
                const ms = new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime();
                return `${Math.round(ms / 100) / 10}s`;
            },
        },
        {
            title: t('Items'),
            key: 'items',
            width: 200,
            render: (_: unknown, r: IInventoryRun) =>
                `${r.itemsCreated || 0}+ / ${r.itemsUpdated || 0}~ / ${r.itemsArchived || 0}× / ${(r.errors?.length || 0)}!`,
        },
        {
            title: t('Status'),
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (s: string) => <Tag color={statusColor(s)}>{s}</Tag>,
        },
        {
            title: t('Actions'),
            key: 'a',
            render: (_: unknown, r: IInventoryRun) => (
                <Button size="small" onClick={() => setErrorDrawer(r)} disabled={!r.errors?.length}>
                    {t('Errors')} ({r.errors?.length || 0})
                </Button>
            ),
        },
    ], [t]);

    const isRunning = !!status?.currentRun && status.currentRun.status === 'running';

    return (
        <div style={{padding: 16}}>
            <Space wrap style={{marginBottom: 16}}>
                <Typography.Title level={4} style={{margin: 0}}>{t('Inventory')}</Typography.Title>
                <Tag color="blue">{status?.adapterId ?? '—'}</Tag>
                {status?.healthOk ? <Badge status="success" text={t('Healthy')}/> : <Badge status="error" text={status?.healthMessage || t('Unreachable')}/>}
                {status?.lastSuccessfulRun?.startedAt
                    ? <Typography.Text type="secondary">{t('Last sync')}: {status.lastSuccessfulRun.startedAt}</Typography.Text>
                    : <Typography.Text type="secondary">{t('No successful sync yet')}</Typography.Text>}
                <Button icon={<ReloadOutlined/>} onClick={refreshStatus} loading={loadingStatus}>{t('Refresh')}</Button>
            </Space>

            <Space wrap style={{marginBottom: 16}}>
                <Button
                    type="primary"
                    onClick={() => runSync('delta')}
                    loading={syncing === 'delta'}
                    disabled={isRunning || !!syncing}
                >{t('Sync delta')}</Button>
                <Popconfirm
                    title={t('Run a full sync? This pages through every warehouse row.')}
                    onConfirm={() => runSync('all')}
                    okText={t('Sync all')}
                    cancelText={t('Cancel')}
                >
                    <Button loading={syncing === 'all'} disabled={isRunning || !!syncing}>{t('Sync all')}</Button>
                </Popconfirm>
                <Button onClick={() => { void refreshDead(); setDeadOpen(true); }}>
                    {t('Show dead letters')}
                </Button>
            </Space>

            {lastReport && (
                <Alert
                    style={{marginBottom: 16}}
                    type={lastReport.status === 'succeeded' ? 'success' : lastReport.status === 'partial' ? 'warning' : 'error'}
                    message={`${t('Last run')}: ${lastReport.itemsCreated} ${t('created')}, ${lastReport.itemsUpdated} ${t('updated')}, ${lastReport.itemsArchived} ${t('archived')}, ${lastReport.errors.length} ${t('errors')}`}
                />
            )}

            <Typography.Title level={5}>{t('Run log')}</Typography.Title>
            <Table
                rowKey="id"
                size="small"
                pagination={false}
                columns={runColumns as any}
                dataSource={runs}
                style={{marginBottom: 24}}
            />

            <Typography.Title level={5}>{t('Adapter config')}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{marginBottom: 12}}>
                {t('Secrets are write-only — saved values are redacted on read. Re-enter the credential on every save.')}
            </Typography.Paragraph>
            <Form layout="vertical">
                <Form.Item label={t('Adapter')}>
                    <Select value={kind} onChange={setKind} style={{width: 240}} options={[
                        {value: 'mock', label: 'Mock (dev / tests)'},
                        {value: 'generic-feed', label: 'Generic feed (HTTP URL)'},
                    ]}/>
                </Form.Item>
                {kind === 'generic-feed' && (
                    <>
                        <Form.Item label={t('URL')}>
                            <Input value={feedUrl} onChange={e => setFeedUrl(e.target.value)} placeholder="https://example.com/products.json"/>
                        </Form.Item>
                        <Form.Item label={t('Auth mode')}>
                            <Select value={authMode} onChange={v => setAuthMode(v)} style={{width: 200}} options={[
                                {value: 'none', label: 'None'},
                                {value: 'bearer', label: 'Bearer token'},
                                {value: 'apiKey', label: 'API key (header)'},
                                {value: 'basic', label: 'Basic (user:pass)'},
                            ]}/>
                        </Form.Item>
                        {authMode !== 'none' && (
                            <Form.Item label={t('Credential (write-only)')}>
                                <Input.Password value={credential} onChange={e => setCredential(e.target.value)} placeholder="•••••"/>
                            </Form.Item>
                        )}
                        <Form.Item label={t('Items path (dot-notation, optional)')}>
                            <Input value={itemsPath} onChange={e => setItemsPath(e.target.value)} placeholder="data.products"/>
                        </Form.Item>
                        <Form.Item label={t('Pagination (JSON)')}>
                            <Input.TextArea value={paginationJson} onChange={e => setPaginationJson(e.target.value)} rows={4}/>
                        </Form.Item>
                        <Form.Item label={t('Field map (JSON)')}>
                            <Input.TextArea value={fieldMapJson} onChange={e => setFieldMapJson(e.target.value)} rows={9}/>
                        </Form.Item>
                    </>
                )}
                <Button type="primary" loading={savingCfg} onClick={saveConfig}>{t('Save adapter config')}</Button>
            </Form>

            <Drawer
                open={!!errorDrawer}
                onClose={() => setErrorDrawer(null)}
                title={t('Run errors')}
                width={520}
            >
                {errorDrawer?.errors?.length ? (
                    <Table
                        size="small"
                        rowKey={(r, i) => `${r.externalId}-${i}`}
                        pagination={false}
                        dataSource={errorDrawer.errors}
                        columns={[
                            {title: 'externalId', dataIndex: 'externalId', key: 'eid', width: 200},
                            {title: 'reason', dataIndex: 'reason', key: 'r'},
                        ] as any}
                    />
                ) : <Typography.Text type="secondary">{t('No errors recorded.')}</Typography.Text>}
            </Drawer>

            <Modal
                open={deadOpen}
                onCancel={() => setDeadOpen(false)}
                onOk={() => setDeadOpen(false)}
                title={t('Dead letters')}
                width={720}
                footer={null}
            >
                <Table
                    size="small"
                    rowKey="externalId"
                    pagination={{pageSize: 20}}
                    dataSource={deadRows}
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
