/**
 * admin-module-composed — Performance (RUM) bridge.
 *
 * The `AdminLoader` bridge for `system/performance`.
 * `PerfBeaconsViewModel` is unchanged ("admin stays mostly same"); the
 * hand-coded card chrome is replaced by a single `AdminInfo` surface.
 * The metric/limit selectors ride in the toolbar slot, the p50/p75/p95
 * summary cards in a bespoke `node` block, and the recent samples in a
 * `table` block.
 *
 * Read-only RUM perf dashboard — W8d.
 *
 * Pulls the last N beacons from `/api/admin/perf-beacons` and renders:
 *   - p50/p75/p95 per metric across the visible window
 *   - a flat table of the most recent samples
 *
 * Deliberately small surface — full APM (trend lines, alerting,
 * per-route breakouts) is out of scope per the W8d brief. Confirms
 * beacons land + surfaces budget-violation visibility.
 */
import React, {useEffect, useMemo} from 'react';
import {Button, Card, Select, Space, Statistic, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {PerfBeaconsViewModel, type PerfBeacon} from './PerfBeaconsViewModel';

const METRIC_OPTIONS = [
    {value: 'all', label: 'All metrics'},
    {value: 'LCP', label: 'LCP'},
    {value: 'CLS', label: 'CLS'},
    {value: 'INP', label: 'INP'},
    {value: 'TTFB', label: 'TTFB'},
    {value: 'FCP', label: 'FCP'},
];

const LIMIT_OPTIONS = [
    {value: 100, label: '100'},
    {value: 200, label: '200'},
    {value: 500, label: '500'},
];

const RATING_COLOUR: Record<string, string> = {
    good: 'green',
    'needs-improvement': 'orange',
    poor: 'red',
};

function fmt(name: string, v: number | null): string {
    if (v === null) return '—';
    if (name === 'CLS') return v.toFixed(3);
    return `${Math.round(v)} ms`;
}

const PerfBeaconsPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new PerfBeaconsViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const columns = useMemo(() => [
        {title: t('Metric'), dataIndex: 'name', key: 'name', width: 80,
            render: (n: string) => <Tag>{n}</Tag>},
        {title: t('Value'), dataIndex: 'value', key: 'value', width: 100,
            render: (v: number, row: PerfBeacon) => fmt(row.name, v)},
        {title: t('Rating'), dataIndex: 'rating', key: 'rating', width: 140,
            render: (r?: string) => r ? <Tag color={RATING_COLOUR[r]}>{r}</Tag> : '—'},
        {title: t('Path'), dataIndex: 'path', key: 'path',
            render: (p: string) => <Typography.Text code style={{fontSize: 12}}>{p}</Typography.Text>},
        {title: t('When'), dataIndex: 'ts', key: 'ts', width: 180,
            render: (ts: number) => <Typography.Text style={{fontFamily: 'monospace', fontSize: 12}}>{new Date(ts).toLocaleString()}</Typography.Text>},
    ] as unknown as ColumnsType<Record<string, unknown>>, [t]);

    const toolbar = (
        <Space wrap>
            <Select
                data-testid="perf-beacons-metric-filter"
                value={vm.metric}
                onChange={(v) => vm.setMetric(v)}
                style={{width: 160}}
                options={METRIC_OPTIONS}
            />
            <Select
                data-testid="perf-beacons-limit"
                value={vm.limit}
                onChange={(v) => vm.setLimit(v)}
                style={{width: 100}}
                options={LIMIT_OPTIONS}
            />
        </Space>
    );

    const blocks: AdminInfoBlock[] = [
        {
            kind: 'node',
            testId: 'perf-beacons-summary',
            node: (
                <Space wrap size="large">
                    {vm.summary.length === 0 ? (
                        <Typography.Text type="secondary" data-testid="perf-beacons-empty">
                            {t('No samples yet — beacons fire from 10% of public visitors.')}
                        </Typography.Text>
                    ) : vm.summary.map(s => (
                        <Card key={s.name} size="small" style={{minWidth: 200}}>
                            <Typography.Text strong>{s.name}</Typography.Text>
                            <div style={{fontSize: 11, color: '#888'}}>{s.count} samples</div>
                            <Space size="small" style={{marginTop: 4}}>
                                <Statistic title="p50" value={fmt(s.name, s.p50)} valueStyle={{fontSize: 14}}/>
                                <Statistic title="p75" value={fmt(s.name, s.p75)} valueStyle={{fontSize: 14}}/>
                                <Statistic title="p95" value={fmt(s.name, s.p95)} valueStyle={{fontSize: 14}}/>
                            </Space>
                        </Card>
                    ))}
                </Space>
            ),
        },
        {
            kind: 'table',
            testId: 'perf-beacons-table',
            columns,
            // Composite key (`ts` alone can collide) projected onto a
            // stable field — the VM stays unchanged.
            rows: vm.filtered.map((r, i) => ({
                ...r,
                _rowKey: `${r.ts}-${r.name}-${r.path}-${i}`,
            })) as unknown as Record<string, unknown>[],
            rowKey: '_rowKey',
            loading: vm.loading,
            pageSize: 25,
        },
    ];

    return (
        <AdminInfoModule
            testId="admin-perf-beacons"
            title={t('Performance — Core Web Vitals (RUM)')}
            headerExtra={
                <Button
                    data-testid="perf-beacons-refresh"
                    onClick={() => { void vm.refresh(); }}
                    loading={vm.loading}
                >
                    {t('Refresh')}
                </Button>
            }
            toolbar={toolbar}
            blocks={blocks}
        />
    );
};

export default PerfBeaconsPanel;
