import React, {useEffect, useMemo} from 'react';
import {Button, Card, Space, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {DiagnosticsViewModel, FeatureSummary, RouteProbe, TrashOverview} from './DiagnosticsViewModel';

/** F5 — admin Diagnostics pane. VM3 (no useState). Manual refresh only. */
const DiagnosticsPane: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new DiagnosticsViewModel());

    useEffect(() => { void vm.refresh(); void vm.runRouteProbes(); }, [vm]);

    const featureCols = useMemo(() => [
        {title: t('Id'), dataIndex: 'id', key: 'id', width: 180,
            render: (id: string) => <Typography.Text code style={{fontSize: 12}}>{id}</Typography.Text>},
        {title: t('Name'), dataIndex: 'displayName', key: 'displayName'},
        {title: t('Enabled'), dataIndex: 'enabled', key: 'enabled', width: 100,
            render: (e: boolean, r: FeatureSummary) => e
                ? <Tag color={r.coreInfrastructure ? 'blue' : 'green'}>{r.coreInfrastructure ? t('core') : t('on')}</Tag>
                : <Tag>{t('off')}</Tag>},
        {title: t('Q'), dataIndex: 'queryCount', key: 'queryCount', width: 60},
        {title: t('M'), dataIndex: 'mutationCount', key: 'mutationCount', width: 60},
        {title: t('Gated M'), dataIndex: 'gatedMutationCount', key: 'gatedMutationCount', width: 80},
        {title: t('Cascades'), dataIndex: 'cascadeRuleCount', key: 'cascadeRuleCount', width: 80},
    ], [t]);

    const trashCols = useMemo(() => [
        {title: t('Collection'), dataIndex: 'collection', key: 'collection',
            render: (c: string) => <Typography.Text code style={{fontSize: 12}}>{c}</Typography.Text>},
        {title: t('Rows'), dataIndex: 'rowCount', key: 'rowCount', width: 80},
        {title: t('Oldest'), dataIndex: 'oldestDeletedAt', key: 'oldestDeletedAt', width: 200,
            render: (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—'},
        {title: t('Groups'), dataIndex: 'distinctTrashGroups', key: 'distinctTrashGroups', width: 80},
    ], [t]);

    const probeCols = useMemo(() => [
        {title: t('Path'), dataIndex: 'path', key: 'path',
            render: (p: string) => <Typography.Text code style={{fontSize: 12}}>{p}</Typography.Text>},
        {title: t('Status'), dataIndex: 'status', key: 'status', width: 100,
            render: (s: number | null) => s == null
                ? <Tag color="red">{t('error')}</Tag>
                : <Tag color={s < 400 ? 'green' : s < 500 ? 'orange' : 'red'}>{String(s)}</Tag>},
        {title: t('Time'), dataIndex: 'ms', key: 'ms', width: 80,
            render: (m: number) => `${m}ms`},
    ], [t]);

    const d = vm.data;
    return (
        <div data-testid="admin-diagnostics" style={{padding: 16}}>
            <Card
                title={t('Diagnostics')}
                extra={
                    <Space>
                        {vm.lastFetchedAt && <Typography.Text type="secondary" style={{fontSize: 12}}>
                            {t('Updated')}: {vm.lastFetchedAt.toLocaleTimeString()}
                        </Typography.Text>}
                        <Button
                            data-testid="diagnostics-refresh"
                            type="primary"
                            loading={vm.loading || vm.probesRunning}
                            onClick={() => { void vm.refresh(); void vm.runRouteProbes(); }}
                        >
                            {t('Refresh')}
                        </Button>
                    </Space>
                }
            >
                {vm.error && <Typography.Text type="danger">{vm.error}</Typography.Text>}
                <Space direction="vertical" size={16} style={{width: '100%'}}>
                    <Card data-testid="section-build" type="inner" title={t('Build identity')}>
                        {d ? (
                            <Space direction="vertical" size={4}>
                                <div><b>{t('Git SHA')}:</b> <Typography.Text code>{d.build.gitSha}</Typography.Text></div>
                                <div><b>{t('Built')}:</b> {d.build.buildTimestamp ?? '—'}</div>
                                <div><b>{t('Active upstream')}:</b> <Typography.Text code>{d.build.activeUpstream}</Typography.Text></div>
                                <div><b>{t('Boot ID')}:</b> <Typography.Text code style={{fontSize: 11}}>{d.build.bootId}</Typography.Text></div>
                                <div><b>{t('Uptime')}:</b> {Math.round(d.build.uptimeMs / 1000)}s</div>
                                <div><b>{t('Env')}:</b> {d.build.nodeEnv} / {d.build.deployTier}</div>
                            </Space>
                        ) : <Typography.Text type="secondary">{t('Loading…')}</Typography.Text>}
                    </Card>

                    <Card data-testid="section-routes" type="inner" title={t('Route registry')}>
                        <Table<RouteProbe>
                            rowKey="path"
                            size="small"
                            dataSource={vm.probes}
                            columns={probeCols as any}
                            pagination={false}
                            loading={vm.probesRunning}
                        />
                    </Card>

                    <Card data-testid="section-features" type="inner" title={t('Feature manifest')}>
                        <Table<FeatureSummary>
                            rowKey="id"
                            size="small"
                            dataSource={d?.features ?? []}
                            columns={featureCols as any}
                            pagination={{pageSize: 30}}
                        />
                    </Card>

                    <Card data-testid="section-storage" type="inner" title={t('Storage health')}>
                        {d ? (
                            <Space direction="vertical">
                                <div>
                                    <b>{t('Mongo')}:</b>{' '}
                                    <Tag color={d.storage.mongo.connected ? 'green' : 'red'}>
                                        {d.storage.mongo.connected ? t('connected') : t('down')}
                                    </Tag>
                                    {d.storage.mongo.replicaSet && <Tag color="blue">{t('replica-set')}</Tag>}
                                    {d.storage.mongo.transactionsSupported && <Tag color="purple">{t('transactions')}</Tag>}
                                </div>
                                <div>
                                    <b>{t('Redis')}:</b>{' '}
                                    <Tag color={d.storage.redis.available ? 'green' : 'orange'}>
                                        {d.storage.redis.available ? t('reachable') : t('unavailable')}
                                    </Tag>
                                </div>
                                <div>
                                    <b>{t('Cache versions')}:</b>{' '}
                                    {Object.keys(d.storage.cacheVersions).length === 0 ? '—' : (
                                        <Space wrap>
                                            {Object.entries(d.storage.cacheVersions).map(([k, v]) => (
                                                <Tag key={k}><Typography.Text code style={{fontSize: 11}}>{k}={v}</Typography.Text></Tag>
                                            ))}
                                        </Space>
                                    )}
                                </div>
                            </Space>
                        ) : <Typography.Text type="secondary">{t('Loading…')}</Typography.Text>}
                    </Card>

                    <Card data-testid="section-trash" type="inner" title={t('Trash overview')}>
                        <Table<TrashOverview>
                            rowKey="collection"
                            size="small"
                            dataSource={d?.trash ?? []}
                            columns={trashCols as any}
                            pagination={false}
                            locale={{emptyText: t('No trash collections — fresh database or nothing deleted yet.')}}
                        />
                    </Card>

                    <Card data-testid="section-idempotency" type="inner" title={t('Idempotency snapshot')}>
                        {d ? (
                            <Space>
                                <span><b>{t('In-flight')}:</b> {d.idempotency.inFlight}</span>
                                <span><b>{t('TTL')}:</b> {d.idempotency.ttlSeconds}s</span>
                            </Space>
                        ) : <Typography.Text type="secondary">{t('Loading…')}</Typography.Text>}
                    </Card>

                    <Card data-testid="section-authz" type="inner" title={t('Authorization snapshot')}>
                        {d ? (
                            <Space direction="vertical">
                                <div><b>{t('Total grants')}:</b> {d.authorization.grantTotal}</div>
                                <div>
                                    <b>{t('By scope')}:</b>{' '}
                                    {Object.keys(d.authorization.grantsByScope).length === 0 ? '—' : (
                                        <Space wrap>
                                            {Object.entries(d.authorization.grantsByScope).map(([k, v]) => (
                                                <Tag key={k}>{k}: {v}</Tag>
                                            ))}
                                        </Space>
                                    )}
                                </div>
                                <div>
                                    <b>{t('Functional roles registered')}:</b>{' '}
                                    {d.authorization.functionalRolesRegistered}
                                </div>
                            </Space>
                        ) : <Typography.Text type="secondary">{t('Loading…')}</Typography.Text>}
                    </Card>
                </Space>
            </Card>
        </div>
    );
};

export default DiagnosticsPane;
