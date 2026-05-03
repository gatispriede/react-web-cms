import React, {useEffect} from 'react';
import {Button, Empty, Popconfirm, Space, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import type {TrashGroupSummary} from '@services/api/client/TrashApi';
import {useRefreshView} from '@client/lib/refreshBus';
import {useViewModel} from '@client/lib/state/observable';
import {TrashViewModel} from './TrashViewModel';

/** Render-only Trash admin pane — VM4 (F2 / data-integrity.md). */
const TrashPane: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new TrashViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    const columns = [
        {
            title: t('Trash group'),
            dataIndex: 'trashGroup',
            key: 'trashGroup',
            ellipsis: true,
            render: (v: string) => <Typography.Text code style={{fontSize: 11}}>{v}</Typography.Text>,
        },
        {
            title: t('Contents'),
            dataIndex: 'summary',
            key: 'summary',
            render: (s: Record<string, number>) => (
                <Space size={4} wrap>
                    {Object.entries(s || {}).map(([coll, n]) => (
                        <Tag key={coll}>{coll}: {n}</Tag>
                    ))}
                </Space>
            ),
        },
        {
            title: t('Age'),
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            width: 140,
            render: (v: string) => <Typography.Text type="secondary">{TrashViewModel.ageLabel(v)}</Typography.Text>,
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 140,
            render: (_: unknown, row: TrashGroupSummary) => (
                <Popconfirm
                    title={t('Restore this group?')}
                    onConfirm={() => void vm.restore(row.trashGroup)}
                    okText={t('Restore')}
                    cancelText={t('Cancel')}
                >
                    <Button size="small" type="primary" loading={Boolean(vm.restoring[row.trashGroup])}>
                        {t('Restore')}
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 12}}>
                <Typography.Title level={4} style={{margin: 0}}>{t('Trash')}</Typography.Title>
                <Typography.Text type="secondary">
                    {t('Soft-deleted rows. Auto-purged after 24h.')}
                </Typography.Text>
                <Button onClick={() => void vm.refresh()} loading={vm.loading}>{t('Refresh')}</Button>
            </Space>

            {vm.groups.length === 0 && !vm.loading ? (
                <Empty description={t('Trash is empty')}/>
            ) : (
                <Table
                    rowKey="trashGroup"
                    loading={vm.loading}
                    columns={columns as any}
                    dataSource={vm.groups}
                    size="small"
                    pagination={false}
                />
            )}
        </div>
    );
};

export default TrashPane;
