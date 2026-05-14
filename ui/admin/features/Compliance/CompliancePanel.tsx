/**
 * admin-module-composed — Compliance bridge.
 *
 * The `AdminLoader` bridge for `system/compliance`.
 * `CompliancePanelViewModel` is unchanged ("admin stays mostly same"),
 * including the `useRefreshView` wiring and the row-level Popconfirm
 * actions; the hand-coded page chrome is replaced by a single
 * `AdminInfo` surface. The limit selector + sweep / refresh buttons
 * ride in the `headerExtra` slot, the three stats in a bespoke `node`
 * block, and the deletion requests in a `table` block.
 *
 * Wave 8b — Admin compliance pane.
 *
 * Shows pending data-export requests + pending deletion requests +
 * retention sweep stats. Three actions:
 *   - Run retention sweep now (notifyPromise)
 *   - Confirm pending deletion (forces purge early)
 *   - Cancel pending deletion (within grace window)
 *
 * `testid`s on every interactive. Predefined-select for limit picker.
 */
import React, {useEffect, useMemo} from 'react';
import {Button, Popconfirm, Select, Space, Statistic, Table, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {ReloadOutlined, CheckCircleFilled, CloseCircleFilled, DeleteOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {useRefreshView} from '@client/lib/refreshBus';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {CompliancePanelViewModel, type DeletionRow} from './CompliancePanelViewModel';

const formatDate = (iso: string | undefined): string => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const CompliancePanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new CompliancePanelViewModel(t));
    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    const columns = useMemo(() => [
        {title: t('User'), dataIndex: 'userId', key: 'userId',
            render: (v: string, r: DeletionRow) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text code style={{fontSize: 12}}>{v}</Typography.Text>
                    {r.email ? <Typography.Text type="secondary" style={{fontSize: 12}}>{r.email}</Typography.Text> : null}
                </Space>
            )},
        {title: t('Requested'), dataIndex: 'requestedAt', key: 'requestedAt', width: 170,
            render: (v: string) => <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>},
        {title: t('Scheduled purge'), dataIndex: 'scheduledFor', key: 'scheduledFor', width: 170,
            render: (v: string) => <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>},
        {title: t('Status'), dataIndex: 'status', key: 'status', width: 110,
            render: (s: string) => {
                if (s === 'purged') return <Tag color="red">{t('compliance.status.purged', {defaultValue: 'Purged'}) as string}</Tag>;
                if (s === 'cancelled') return <Tag>{t('compliance.status.cancelled', {defaultValue: 'Cancelled'}) as string}</Tag>;
                return <Tag color="gold">{t('compliance.status.pending', {defaultValue: 'Pending'}) as string}</Tag>;
            }},
        {title: t('Actions'), key: 'actions', width: 220,
            render: (_: unknown, r: DeletionRow) => {
                if (r.status !== 'pending') return null;
                return (
                    <Space size={4}>
                        <Popconfirm
                            title={t('compliance.confirm.title', {defaultValue: 'Confirm deletion now?'}) as string}
                            description={t('compliance.confirm.body', {defaultValue: 'Marks the deletion as purged immediately. The 24h trash TTL already evaporated row-level data.'}) as string}
                            onConfirm={() => vm.confirmDeletion(r.userId)}
                            okButtonProps={{danger: true}}
                        >
                            <Button data-testid={`compliance-del-${r.userId}-confirm-button`} size="small" type="primary" danger icon={<CheckCircleFilled/>}>
                                {t('compliance.confirm.cta', {defaultValue: 'Confirm purge'}) as string}
                            </Button>
                        </Popconfirm>
                        <Popconfirm
                            title={t('compliance.cancel.title', {defaultValue: 'Cancel deletion?'}) as string}
                            onConfirm={() => vm.cancelDeletion(r.userId)}
                        >
                            <Button data-testid={`compliance-del-${r.userId}-cancel-button`} size="small" icon={<CloseCircleFilled/>}>
                                {t('Cancel', {defaultValue: 'Cancel'}) as string}
                            </Button>
                        </Popconfirm>
                    </Space>
                );
            }},
    ] as unknown as ColumnsType<Record<string, unknown>>, [t, vm]);

    const headerExtra = (
        <Space>
            <Select
                data-testid="compliance-limit-select"
                value={vm.limit}
                style={{minWidth: 100}}
                onChange={(v: number) => { vm.setLimit(v); void vm.refresh(); }}
                options={[
                    {value: 25, label: '25'},
                    {value: 50, label: '50'},
                    {value: 100, label: '100'},
                    {value: 250, label: '250'},
                ]}
            />
            <Button
                data-testid="compliance-sweep-button"
                icon={<DeleteOutlined/>}
                loading={vm.busy}
                onClick={() => void vm.runSweep()}
            >
                {t('compliance.sweep.cta', {defaultValue: 'Run retention sweep'}) as string}
            </Button>
            <Button data-testid="compliance-refresh-button" icon={<ReloadOutlined/>} loading={vm.loading} onClick={() => void vm.refresh()}>
                {t('Refresh', {defaultValue: 'Refresh'}) as string}
            </Button>
        </Space>
    );

    const blocks: AdminInfoBlock[] = [
        {
            kind: 'node',
            testId: 'compliance-stats',
            node: (
                <Space size="large" wrap>
                    <Statistic
                        title={t('compliance.stats.pendingDeletions', {defaultValue: 'Pending deletions'}) as string}
                        value={vm.deletions.filter(d => d.status === 'pending').length}
                    />
                    <Statistic
                        title={t('compliance.stats.lastSweep', {defaultValue: 'Last sweep'}) as string}
                        value={vm.lastSweep ?? '—'}
                        valueStyle={{fontSize: 16}}
                    />
                    <Statistic
                        title={t('compliance.stats.bannerVersion', {defaultValue: 'Cookie banner version'}) as string}
                        value={1}
                    />
                </Space>
            ),
        },
        {
            // Kept as a bespoke `node` (not an `AdminInfo` `table`
            // block) — the row-level `data-testid` the e2e suite
            // asserts on isn't expressible through the `table` shape.
            kind: 'node',
            heading: t('compliance.deletions.title', {defaultValue: 'Pending deletion requests'}) as string,
            testId: 'compliance-deletions-block',
            node: (
                <Table
                    data-testid="compliance-deletions-table"
                    rowKey={(r: DeletionRow) => r.id}
                    loading={vm.loading}
                    dataSource={vm.deletions}
                    columns={columns as unknown as ColumnsType<DeletionRow>}
                    pagination={{pageSize: 25}}
                    size="middle"
                    onRow={(r: DeletionRow) => ({'data-testid': `compliance-deletion-row-${r.userId}`} as never)}
                />
            ),
        },
    ];

    return (
        <div data-testid="compliance-admin-panel">
            <AdminInfoModule
                testId="admin-compliance"
                title={t('compliance.title', {defaultValue: 'Compliance'}) as string}
                headerExtra={headerExtra}
                blocks={blocks}
            />
        </div>
    );
};

export default CompliancePanel;
