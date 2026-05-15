/**
 * admin-module-composed — Backup + DR bridge.
 *
 * Was a bespoke hand-coded pane; now the `AdminLoader` *bridge* for
 * `system/backups`. `BackupPanelViewModel` + the bespoke summary card
 * (manual "Backup now" / "Verify" actions) and snapshot table stay
 * 100% unchanged ("admin stays mostly same"); only the outer `<div>` +
 * header chrome moves into the generic `AdminInfo` view-module shape.
 * This pane is a read-only dashboard with imperative actions — not a
 * single-doc form — so it composes `AdminInfoModule`, with the
 * disabled banner / summary card / snapshot card carried as bespoke
 * `node` blocks and the Refresh button as `headerExtra`.
 *
 * Registered with the `AdminPageRegistry` by `BackupAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `BackupAdminUILoader`).
 */
import React, {useEffect, useMemo} from 'react';
import {Alert, Badge, Button, Card, Popconfirm, Space, Table, Tag, Tooltip, Typography} from 'antd';
import {ReloadOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import EmptyState from '@admin/lib/EmptyState';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {BackupPanelViewModel} from './BackupPanelViewModel';
import type {BackupSnapshotRow} from '@services/api/client/BackupApi';

function fmtBytes(b?: number | null): string {
    if (typeof b !== 'number') return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDuration(ms?: number | null): string {
    if (typeof ms !== 'number') return '—';
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    return `${(ms / 60_000).toFixed(1)} min`;
}

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
    if (!d || Number.isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

const BackupPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new BackupPanelViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);

    const last = vm.status.last as {snapshotId?: string; sizeBytes?: number; completedAt?: string; durationMs?: number; ok?: boolean} | null;
    const lastDrill = vm.status.lastDrill as {ok?: boolean; completedAt?: string; durationMs?: number; snapshotAgeMs?: number} | null;

    const snapColumns = useMemo(() => [
        {title: t('backup.col.snapshotId'), dataIndex: 'id', key: 'id', width: 140,
            render: (id: string) => <Typography.Text code data-testid={`backup-snapshot-id-${id}`}>{id}</Typography.Text>},
        {title: t('backup.col.time'), dataIndex: 'time', key: 'time', width: 200, render: (s: string) => fmtDate(s)},
        {title: t('backup.col.size'), dataIndex: 'sizeBytes', key: 'sz', width: 120, render: (b?: number) => fmtBytes(b)},
        {title: t('backup.col.tags'), dataIndex: 'tags', key: 'tg',
            render: (tags: string[]) => tags?.length ? <Space size={4} wrap>{tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</Space> : '—'},
        {title: t('backup.col.actions'), key: 'a', width: 280,
            render: (_: unknown, row: BackupSnapshotRow) => (
                <Space>
                    <Tooltip title={t('backup.col.verifyTooltip')}>
                        <Button
                            size="small"
                            data-testid={`backup-snapshot-verify-${row.id}`}
                            disabled={vm.running === 'verify'}
                            onClick={() => void vm.verify()}
                        >{t('backup.col.verify')}</Button>
                    </Tooltip>
                    <Popconfirm
                        title={t('backup.confirm.restoreStaging')}
                        onConfirm={() => void vm.restoreToStaging(row.id)}
                        okText={t('backup.confirm.restore')}
                        cancelText={t('backup.confirm.cancel')}
                    >
                        <Button
                            size="small"
                            type="primary"
                            ghost
                            data-testid={`backup-snapshot-restore-${row.id}`}
                            loading={vm.restoringId === row.id}
                            disabled={vm.restoringId !== null && vm.restoringId !== row.id}
                        >{t('backup.col.restoreStaging')}</Button>
                    </Popconfirm>
                </Space>
            )},
    ], [t, vm]);

    const blocks: AdminInfoBlock[] = [];

    if (vm.disabled) {
        blocks.push({
            kind: 'node',
            testId: 'backup-disabled-block',
            node: (
                <Alert
                    type="warning"
                    showIcon
                    data-testid="backup-disabled-banner"
                    message={t('backup.disabled.title')}
                    description={t('backup.disabled.body')}
                />
            ),
        });
    }

    blocks.push({
        kind: 'node',
        testId: 'backup-summary-block',
        node: (
            <Card title={t('backup.summary.title')} data-testid="backup-summary-card">
                <Space size="large" wrap>
                    <div>
                        <Typography.Text type="secondary">{t('backup.summary.lastBackup')}</Typography.Text>
                        <div>
                            {last?.ok
                                ? <Badge status="success" text={fmtDate(last.completedAt)}/>
                                : <Badge status="default" text={t('backup.summary.never')}/>}
                        </div>
                    </div>
                    <div>
                        <Typography.Text type="secondary">{t('backup.summary.size')}</Typography.Text>
                        <div data-testid="backup-summary-size">{fmtBytes(last?.sizeBytes)}</div>
                    </div>
                    <div>
                        <Typography.Text type="secondary">{t('backup.summary.duration')}</Typography.Text>
                        <div>{fmtDuration(last?.durationMs)}</div>
                    </div>
                    <div>
                        <Typography.Text type="secondary">{t('backup.summary.snapshotCount')}</Typography.Text>
                        <div data-testid="backup-summary-snapshot-count">{vm.snapshots.length}</div>
                    </div>
                    <div>
                        <Typography.Text type="secondary">{t('backup.summary.lastDrill')}</Typography.Text>
                        <div data-testid="backup-summary-last-drill">
                            {lastDrill
                                ? <Badge status={lastDrill.ok ? 'success' : 'error'} text={fmtDate(lastDrill.completedAt)}/>
                                : <Badge status="default" text={t('backup.summary.never')}/>}
                        </div>
                    </div>
                </Space>
                <div style={{marginTop: 16}}>
                    <Space>
                        <Popconfirm
                            title={t('backup.confirm.backupNow')}
                            onConfirm={() => void vm.backupNow()}
                            okText={t('backup.confirm.run')}
                            cancelText={t('backup.confirm.cancel')}
                        >
                            <Button
                                type="primary"
                                data-testid="backup-now-button"
                                loading={vm.running === 'backup'}
                                disabled={vm.disabled || vm.running !== null}
                            >{t('backup.action.backupNow')}</Button>
                        </Popconfirm>
                        <Button
                            data-testid="backup-verify-button"
                            loading={vm.running === 'verify'}
                            disabled={vm.disabled || vm.running !== null}
                            onClick={() => void vm.verify()}
                        >{t('backup.action.verify')}</Button>
                    </Space>
                </div>
            </Card>
        ),
    });

    blocks.push({
        kind: 'node',
        testId: 'backup-snapshots-block',
        node: (
            <Card title={t('backup.snapshots.title')} data-testid="backup-snapshots-card"
                extra={<Button size="small" icon={<ReloadOutlined/>} data-testid="backup-snapshots-refresh"
                    loading={vm.listing} onClick={() => void vm.refreshSnapshots()}>{t('backup.refresh')}</Button>}>
                <Table
                    rowKey="id"
                    size="small"
                    columns={snapColumns as any}
                    dataSource={vm.snapshots}
                    loading={vm.listing}
                    pagination={{pageSize: 10}}
                    data-testid="backup-snapshots-table"
                    locale={{
                        emptyText: (
                            <EmptyState
                                testId="backup-snapshots-empty"
                                title={t('backup.empty.title')}
                                description={t('backup.empty.description')}
                                art="generic"
                            />
                        ),
                    }}
                />
            </Card>
        ),
    });

    return (
        <AdminInfoModule
            testId="backup-panel"
            title={t('backup.title')}
            headerExtra={
                <Button
                    icon={<ReloadOutlined/>}
                    data-testid="backup-refresh-button"
                    loading={vm.loading}
                    onClick={() => void vm.refresh()}
                >{t('backup.refresh')}</Button>
            }
            blocks={blocks}
        />
    );
};

export default BackupPanel;
