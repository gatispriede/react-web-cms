/**
 * admin-module-composed — Analytics filters bridge.
 *
 * The `AdminLoader` bridge for `system/analytics-filters`.
 * `AnalyticsFiltersViewModel` is unchanged ("admin stays mostly same");
 * the hand-coded card chrome is replaced by a single `AdminInfo`
 * surface. The IP allowlist is an editable table block; the info /
 * error / saved alerts ride in the toolbar slot.
 *
 * Admin pane for the analytics IP allowlist —
 * `/admin/system/analytics-filters`. Per `docs/features/platform/client-analytics.md` v2.
 *
 * Editing experience is intentionally dumb: a flat table of IP + label
 * rows, add/remove buttons, single Save that does a wholesale replace.
 * No CIDR, no paging, no search — for the "filter ourselves out" use
 * case the list is < 20 entries in practice. If a real corporate
 * network needs CIDR later, swap the storage shape; the UI grows
 * a "rules" tab next to "exact IPs".
 *
 * IP entries that match the request IP at ingest tag the row as
 * `audience: 'internal'`, which the dashboard hides from the default
 * "Public" filter chip.
 */
import React, {useEffect} from 'react';
import {Alert, Button, Input, Space, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {DeleteOutlined, PlusOutlined, SaveOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {AnalyticsFiltersViewModel, type IpRow} from './AnalyticsFiltersViewModel';

const AnalyticsFiltersPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new AnalyticsFiltersViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const columns = [
        {
            title: t('IP address'),
            dataIndex: 'ip',
            key: 'ip',
            render: (_: string, row: IpRow) => (
                <Input
                    size="small"
                    value={row.ip}
                    placeholder="203.0.113.42"
                    onChange={(e) => vm.updateRow(row.key, {ip: e.target.value})}
                    style={{maxWidth: 280}}
                />
            ),
        },
        {
            title: t('Label'),
            dataIndex: 'label',
            key: 'label',
            render: (_: string, row: IpRow) => (
                <Input
                    size="small"
                    value={row.label}
                    placeholder={t('office router, alex home, …')}
                    onChange={(e) => vm.updateRow(row.key, {label: e.target.value})}
                />
            ),
        },
        {
            title: '',
            key: 'actions',
            width: 60,
            align: 'right' as const,
            render: (_: unknown, row: IpRow) => (
                <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined/>}
                    onClick={() => vm.removeRow(row.key)}
                />
            ),
        },
    ] as unknown as ColumnsType<Record<string, unknown>>;

    const toolbar = (
        <>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 12}}
                message={t('Requests from these IPs are tagged audience: "internal" and hidden from the default Public filter on the analytics dashboard. Exact match only — CIDR not yet supported.')}
            />
            {vm.error && <Alert type="error" showIcon message={vm.error} style={{marginBottom: 12}}/>}
            {vm.saved && <Alert type="success" showIcon message={t('Saved.')} style={{marginBottom: 12}}/>}
        </>
    );

    const blocks: AdminInfoBlock[] = [
        {
            kind: 'table',
            testId: 'analytics-filters-table',
            columns,
            rows: vm.rows as unknown as Record<string, unknown>[],
            rowKey: 'key',
            loading: vm.loading,
            emptyText: t('No internal IPs configured. Click "Add IP" to start.'),
        },
    ];

    if (vm.updatedAt) {
        blocks.push({
            kind: 'node',
            testId: 'analytics-filters-updated',
            node: (
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('Last edited {{when}} by {{who}}', {
                        when: new Date(vm.updatedAt).toLocaleString(),
                        who: vm.updatedBy || 'unknown',
                    })}
                </Typography.Text>
            ),
        });
    }

    return (
        <AdminInfoModule
            testId="admin-analytics-filters"
            title={t('Analytics filters — internal IPs')}
            headerExtra={
                <Space>
                    <Button icon={<PlusOutlined/>} onClick={() => vm.addRow()}>{t('Add IP')}</Button>
                    <Button
                        type="primary"
                        icon={<SaveOutlined/>}
                        loading={vm.saving}
                        onClick={() => void vm.save()}
                    >{t('Save')}</Button>
                </Space>
            }
            toolbar={toolbar}
            blocks={blocks}
        />
    );
};

export default AnalyticsFiltersPanel;
