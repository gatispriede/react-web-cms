/**
 * admin-module-composed (Batch 1) — Diagnostics bridge.
 *
 * Was a bespoke hand-coded pane; now the `AdminLoader` *bridge* for
 * `system/info`. It keeps `DiagnosticsViewModel` unchanged ("admin
 * stays mostly same") and just maps the VM snapshot onto the generic
 * `AdminInfo` view module's blocks. VM3 — no `useState`.
 *
 * Registered with the `AdminPageRegistry` by `DiagnosticsAdminLoader`;
 * the shell reaches it via `AdminPageDispatch` (see
 * `DiagnosticsAdminUILoader`).
 */
import React, {useEffect, useMemo} from 'react';
import {Button, Space, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {DiagnosticsViewModel, type FeatureSummary} from './DiagnosticsViewModel';

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
    ] as unknown as ColumnsType<Record<string, unknown>>, [t]);

    const trashCols = useMemo(() => [
        {title: t('Collection'), dataIndex: 'collection', key: 'collection',
            render: (c: string) => <Typography.Text code style={{fontSize: 12}}>{c}</Typography.Text>},
        {title: t('Rows'), dataIndex: 'rowCount', key: 'rowCount', width: 80},
        {title: t('Oldest'), dataIndex: 'oldestDeletedAt', key: 'oldestDeletedAt', width: 200,
            render: (iso: string | null) => iso ? new Date(iso).toLocaleString() : '—'},
        {title: t('Groups'), dataIndex: 'distinctTrashGroups', key: 'distinctTrashGroups', width: 80},
    ] as unknown as ColumnsType<Record<string, unknown>>, [t]);

    const probeCols = useMemo(() => [
        {title: t('Path'), dataIndex: 'path', key: 'path',
            render: (p: string) => <Typography.Text code style={{fontSize: 12}}>{p}</Typography.Text>},
        {title: t('Status'), dataIndex: 'status', key: 'status', width: 100,
            render: (s: number | null) => s == null
                ? <Tag color="red">{t('error')}</Tag>
                : <Tag color={s < 400 ? 'green' : s < 500 ? 'orange' : 'red'}>{String(s)}</Tag>},
        {title: t('Time'), dataIndex: 'ms', key: 'ms', width: 80,
            render: (m: number) => `${m}ms`},
    ] as unknown as ColumnsType<Record<string, unknown>>, [t]);

    const d = vm.data;
    const blocks: AdminInfoBlock[] = [
        {
            kind: 'keyValue', heading: t('Build identity'), testId: 'section-build', loading: !d,
            rows: d ? [
                {label: t('Git SHA'), value: <Typography.Text code>{d.build.gitSha}</Typography.Text>},
                {label: t('Built'), value: d.build.buildTimestamp ?? '—'},
                {label: t('Active upstream'), value: <Typography.Text code>{d.build.activeUpstream}</Typography.Text>},
                {label: t('Boot ID'), value: <Typography.Text code style={{fontSize: 11}}>{d.build.bootId}</Typography.Text>},
                {label: t('Uptime'), value: `${Math.round(d.build.uptimeMs / 1000)}s`},
                {label: t('Env'), value: `${d.build.nodeEnv} / ${d.build.deployTier}`},
            ] : [],
        },
        {
            kind: 'table', heading: t('Route registry'), testId: 'section-routes',
            columns: probeCols, rows: vm.probes as unknown as Record<string, unknown>[],
            rowKey: 'path', loading: vm.probesRunning,
        },
        {
            kind: 'table', heading: t('Feature manifest'), testId: 'section-features',
            columns: featureCols, rows: (d?.features ?? []) as unknown as Record<string, unknown>[],
            rowKey: 'id', pageSize: 30,
        },
        {
            kind: 'keyValue', heading: t('Storage health'), testId: 'section-storage', loading: !d,
            rows: d ? [
                {
                    label: t('Mongo'),
                    value: (
                        <Space size={4} wrap>
                            <Tag color={d.storage.mongo.connected ? 'green' : 'red'}>
                                {d.storage.mongo.connected ? t('connected') : t('down')}
                            </Tag>
                            {d.storage.mongo.replicaSet && <Tag color="blue">{t('replica-set')}</Tag>}
                            {d.storage.mongo.transactionsSupported && <Tag color="purple">{t('transactions')}</Tag>}
                        </Space>
                    ),
                },
                {
                    label: t('Redis'),
                    value: (
                        <Tag color={d.storage.redis.available ? 'green' : 'orange'}>
                            {d.storage.redis.available ? t('reachable') : t('unavailable')}
                        </Tag>
                    ),
                },
                {
                    label: t('Cache versions'),
                    value: Object.keys(d.storage.cacheVersions).length === 0 ? '—' : (
                        <Space wrap size={4}>
                            {Object.entries(d.storage.cacheVersions).map(([k, v]) => (
                                <Tag key={k}><Typography.Text code style={{fontSize: 11}}>{k}={v}</Typography.Text></Tag>
                            ))}
                        </Space>
                    ),
                },
            ] : [],
        },
        {
            kind: 'table', heading: t('Trash overview'), testId: 'section-trash',
            columns: trashCols, rows: (d?.trash ?? []) as unknown as Record<string, unknown>[],
            rowKey: 'collection',
            emptyText: t('No trash collections — fresh database or nothing deleted yet.'),
        },
        {
            kind: 'keyValue', heading: t('Idempotency snapshot'), testId: 'section-idempotency', loading: !d,
            rows: d ? [
                {label: t('In-flight'), value: String(d.idempotency.inFlight)},
                {label: t('TTL'), value: `${d.idempotency.ttlSeconds}s`},
            ] : [],
        },
    ];

    if (d?.mcpCoverage) {
        blocks.push({
            kind: 'keyValue', heading: t('MCP coverage'), testId: 'section-mcp-coverage',
            rows: [
                {label: t('Tools'), value: String(d.mcpCoverage.toolCount)},
                {
                    label: t('Categories'),
                    value: (
                        <Space wrap size={4}>
                            {Object.entries(d.mcpCoverage.categories).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => (
                                <Tag key={k}>{k}: {v}</Tag>
                            ))}
                        </Space>
                    ),
                },
            ],
        });
    }

    blocks.push({
        kind: 'keyValue', heading: t('Authorization snapshot'), testId: 'section-authz', loading: !d,
        rows: d ? [
            {label: t('Total grants'), value: String(d.authorization.grantTotal)},
            {
                label: t('By scope'),
                value: Object.keys(d.authorization.grantsByScope).length === 0 ? '—' : (
                    <Space wrap size={4}>
                        {Object.entries(d.authorization.grantsByScope).map(([k, v]) => (
                            <Tag key={k}>{k}: {v}</Tag>
                        ))}
                    </Space>
                ),
            },
            {label: t('Functional roles registered'), value: String(d.authorization.functionalRolesRegistered)},
        ] : [],
    });

    return (
        <AdminInfoModule
            testId="admin-diagnostics"
            title={t('Diagnostics')}
            error={vm.error}
            lastUpdatedLabel={vm.lastFetchedAt ? `${t('Updated')}: ${vm.lastFetchedAt.toLocaleTimeString()}` : undefined}
            headerExtra={
                <Button
                    data-testid="diagnostics-refresh"
                    type="primary"
                    loading={vm.loading || vm.probesRunning}
                    onClick={() => { void vm.refresh(); void vm.runRouteProbes(); }}
                >
                    {t('Refresh')}
                </Button>
            }
            blocks={blocks}
        />
    );
};

export default DiagnosticsPane;
