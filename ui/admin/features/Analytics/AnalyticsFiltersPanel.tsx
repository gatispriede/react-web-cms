import React, {useEffect} from 'react';
import {Alert, Button, Card, Input, Space, Table, Typography} from 'antd';
import {DeleteOutlined, PlusOutlined, SaveOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {AnalyticsFiltersViewModel, type IpRow} from './AnalyticsFiltersViewModel';

/**
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
    ];

    return (
        <div style={{padding: 16}}>
            <Card
                title={t('Analytics filters — internal IPs')}
                extra={
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
            >
                <Alert
                    type="info"
                    showIcon
                    style={{marginBottom: 12}}
                    message={t('Requests from these IPs are tagged audience: "internal" and hidden from the default Public filter on the analytics dashboard. Exact match only — CIDR not yet supported.')}
                />
                {vm.error && <Alert type="error" showIcon message={vm.error} style={{marginBottom: 12}}/>}
                {vm.saved && <Alert type="success" showIcon message={t('Saved.')} style={{marginBottom: 12}}/>}

                <Table<IpRow>
                    rowKey="key"
                    size="small"
                    pagination={false}
                    loading={vm.loading}
                    dataSource={vm.rows}
                    columns={columns}
                    locale={{emptyText: t('No internal IPs configured. Click "Add IP" to start.')}}
                />

                {vm.updatedAt && (
                    <Typography.Text type="secondary" style={{display: 'block', marginTop: 12, fontSize: 12}}>
                        {t('Last edited {{when}} by {{who}}', {
                            when: new Date(vm.updatedAt).toLocaleString(),
                            who: vm.updatedBy || 'unknown',
                        })}
                    </Typography.Text>
                )}
            </Card>
        </div>
    );
};

export default AnalyticsFiltersPanel;
