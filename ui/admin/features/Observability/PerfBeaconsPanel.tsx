import React, {useEffect, useMemo} from 'react';
import {Button, Card, Select, Space, Statistic, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {PerfBeaconsViewModel, type PerfBeacon} from './PerfBeaconsViewModel';

/**
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
    ], [t]);

    return (
        <div style={{padding: 16}}>
            <Card
                title={t('Performance — Core Web Vitals (RUM)')}
                extra={
                    <Button
                        data-testid="perf-beacons-refresh"
                        onClick={() => { void vm.refresh(); }}
                        loading={vm.loading}
                    >
                        {t('Refresh')}
                    </Button>
                }
            >
                <Space wrap style={{marginBottom: 16}}>
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

                <Space wrap size="large" style={{marginBottom: 16}}>
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

                <Table<PerfBeacon>
                    data-testid="perf-beacons-table"
                    rowKey={(r) => `${r.ts}-${r.name}-${r.path}`}
                    size="small"
                    loading={vm.loading}
                    dataSource={vm.filtered}
                    columns={columns as any}
                    pagination={{pageSize: 25}}
                />
            </Card>
        </div>
    );
};

export default PerfBeaconsPanel;
