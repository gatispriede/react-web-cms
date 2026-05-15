/**
 * Phase 1.C — WarehouseSyncPanel admin pane.
 *
 * Operator surface for the `WarehousePageSyncWorker`:
 *
 *   - Last sync time per adapter (clock + counts)
 *   - "Sync now" button — calls `pages.warehouseSync.run`
 *   - "Preview dry-run" — calls `pages.warehouseSync.preview`
 *   - Filterable per-page outcome list (predefined Select)
 *
 * Sonner `notifyPromise` covers the long-running actions; `data-testid`
 * lives on every interactive (testid-CI enforces).
 */
import React, {useEffect} from 'react';
import {Alert, Button, Card, Empty, Select, Space, Statistic, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {WarehouseSyncViewModel, PER_PAGE_OUTCOME_OPTIONS, type SyncPerPage} from './WarehouseSyncViewModel';

const OUTCOME_COLOR: Record<SyncPerPage['outcome'], string> = {
    'created': 'success',
    'updated': 'processing',
    'soft-deleted': 'warning',
    'skipped-operator-edited': 'default',
};

const FILTER_OPTIONS = [
    {value: 'all', label: 'All outcomes'},
    ...PER_PAGE_OUTCOME_OPTIONS,
];

const WarehouseSyncPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new WarehouseSyncViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const last = vm.lastStatus;

    const perPageColumns = [
        {title: t('Slug'), dataIndex: 'slug', key: 'slug', render: (v: string) => <Typography.Text code>{v}</Typography.Text>},
        {
            title: t('Outcome'),
            dataIndex: 'outcome',
            key: 'outcome',
            render: (v: SyncPerPage['outcome']) => <Tag color={OUTCOME_COLOR[v]}>{v}</Tag>,
        },
        {title: t('Reason'), dataIndex: 'reason', key: 'reason'},
    ];

    return (
        <div className="warehouse-sync-panel" data-testid="warehouse-sync-panel">
            <Typography.Title level={3}>{t('Warehouse page sync')}</Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('Mirrors the upstream warehouse catalogue into the page tree. Cron runs every 5 min; trigger manually below.')}
            </Typography.Paragraph>

            <Space wrap style={{marginBottom: 16}}>
                <Button
                    type="primary"
                    onClick={() => void vm.syncNow()}
                    loading={vm.syncing}
                    data-testid="warehouse-sync-now"
                >
                    {t('Sync now')}
                </Button>
                <Button
                    onClick={() => void vm.preview()}
                    loading={vm.previewing}
                    data-testid="warehouse-sync-preview"
                >
                    {t('Preview dry-run')}
                </Button>
            </Space>

            {last ? (
                <Card title={t('Last sync — {{adapter}}', {adapter: last.adapterId})} data-testid="warehouse-sync-last-card">
                    <Space wrap size="large">
                        <Statistic title={t('Created')} value={last.created} data-testid="warehouse-sync-stat-created" />
                        <Statistic title={t('Updated')} value={last.updated} data-testid="warehouse-sync-stat-updated" />
                        <Statistic title={t('Soft-deleted')} value={last.softDeleted} data-testid="warehouse-sync-stat-soft-deleted" />
                        <Statistic title={t('Skipped (operator-edited)')} value={last.skippedOperatorEdited} data-testid="warehouse-sync-stat-skipped" />
                        <Statistic title={t('Errors')} value={last.errors} data-testid="warehouse-sync-stat-errors" />
                    </Space>
                    <Typography.Paragraph type="secondary" style={{marginTop: 12, marginBottom: 0}}>
                        {t('Finished {{at}} · {{ms}} ms', {at: last.finishedAt, ms: last.durationMs})}
                    </Typography.Paragraph>
                </Card>
            ) : (
                <Empty description={t('No sync run yet this boot')} data-testid="warehouse-sync-empty" />
            )}

            {vm.previewResults.length > 0 && (
                <Card title={t('Dry-run preview')} style={{marginTop: 16}} data-testid="warehouse-sync-preview-card">
                    <Alert type="info" showIcon message={t('Dry-run — no writes performed.')} style={{marginBottom: 12}} />
                    <Space style={{marginBottom: 12}}>
                        <span>{t('Filter')}:</span>
                        <Select<typeof vm.outcomeFilter>
                            value={vm.outcomeFilter}
                            onChange={(v) => vm.setOutcomeFilter(v)}
                            options={[...FILTER_OPTIONS]}
                            style={{minWidth: 220}}
                            data-testid="warehouse-sync-filter"
                        />
                    </Space>
                    <Table
                        rowKey={(r) => `${r.slug}-${r.outcome}`}
                        columns={perPageColumns}
                        dataSource={[...vm.filteredPerPage]}
                        pagination={{pageSize: 20}}
                        size="small"
                        data-testid="warehouse-sync-preview-table"
                    />
                </Card>
            )}
        </div>
    );
};

export default WarehouseSyncPanel;
export {WarehouseSyncPanel};
