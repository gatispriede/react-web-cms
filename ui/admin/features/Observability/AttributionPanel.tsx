/**
 * admin-module-composed — Marketing attribution bridge.
 *
 * The `AdminLoader` bridge for `marketing/attribution`.
 * `AttributionViewModel` is unchanged ("admin stays mostly same"); the
 * hand-coded card chrome is replaced by a single `AdminInfo` surface.
 * The group-by / range selectors ride in the toolbar slot, the
 * total-hits / tracked-keys stats in a bespoke `node` block, and the
 * aggregated report in a `table` block (or a disabled-feature node).
 *
 * W6c — admin marketing attribution pane.
 *
 * Read-only aggregated report over the `MarketingReferrer` collection.
 * Group by UTM source / UTM campaign / named ref slug; range knob
 * controls the lookback window. Numbers mirror the
 * `marketing.attribution.list` MCP tool so AI + admin see the same
 * figures.
 *
 * `useState` is banned in admin features per VM4 — all knobs live on
 * `AttributionViewModel`.
 */
import React, {useEffect, useMemo} from 'react';
import {Button, Select, Space, Statistic, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {AttributionViewModel, type AttributionRow} from './AttributionViewModel';

const GROUP_OPTIONS = [
    {value: 'source', label: 'UTM source'},
    {value: 'campaign', label: 'UTM campaign'},
    {value: 'ref', label: 'Referrer slug (?ref=)'},
];

const RANGE_OPTIONS = [
    {value: '7d', label: 'Last 7 days'},
    {value: '30d', label: 'Last 30 days'},
    {value: '90d', label: 'Last 90 days'},
    {value: 'all', label: 'All time'},
];

const AttributionPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new AttributionViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const columns = useMemo(() => [
        {title: t('Key'), dataIndex: 'key', key: 'key',
            render: (k: string) => <Typography.Text code>{k || '(none)'}</Typography.Text>},
        {title: t('Hits'), dataIndex: 'hits', key: 'hits', width: 100, sorter: (a: AttributionRow, b: AttributionRow) => a.hits - b.hits},
        {title: t('Signups'), dataIndex: 'signups', key: 'signups', width: 100, sorter: (a: AttributionRow, b: AttributionRow) => a.signups - b.signups},
        {title: t('Orders'), dataIndex: 'orders', key: 'orders', width: 100},
        {title: t('Last seen'), dataIndex: 'lastSeen', key: 'lastSeen', width: 200,
            render: (v?: string) => v ? new Date(v).toLocaleString() : '—'},
    ] as unknown as ColumnsType<Record<string, unknown>>, [t]);

    const toolbar = (
        <Space wrap>
            <Select
                data-testid="attribution-group-by"
                value={vm.groupBy}
                onChange={(v) => vm.setGroupBy(v as any)}
                style={{width: 220}}
                options={GROUP_OPTIONS}
            />
            <Select
                data-testid="attribution-range"
                value={vm.range}
                onChange={(v) => vm.setRange(v as any)}
                style={{width: 180}}
                options={RANGE_OPTIONS}
            />
        </Space>
    );

    const blocks: AdminInfoBlock[] = [
        {
            kind: 'node',
            testId: 'attribution-stats',
            node: (
                <Space wrap size="large">
                    <Statistic title={t('Total hits')} value={vm.total} valueStyle={{fontSize: 18}}/>
                    <Statistic title={t('Tracked keys')} value={vm.rows.length} valueStyle={{fontSize: 18}}/>
                </Space>
            ),
        },
        vm.disabled ? {
            kind: 'node',
            testId: 'attribution-disabled-block',
            node: (
                <Typography.Text type="secondary" data-testid="attribution-disabled">
                    {t('Marketing feature is disabled — enable in System → Features to capture attribution.')}
                </Typography.Text>
            ),
        } : {
            kind: 'table',
            testId: 'attribution-table',
            columns,
            rows: vm.rows as unknown as Record<string, unknown>[],
            rowKey: 'key',
            loading: vm.loading,
            pageSize: 25,
            emptyText: t('No attribution hits captured yet — UTM-tagged visits will appear here.'),
        },
    ];

    return (
        <AdminInfoModule
            testId="admin-attribution"
            title={t('Marketing attribution')}
            headerExtra={
                <Button
                    data-testid="attribution-refresh"
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

export default AttributionPanel;
