import React, {useEffect} from 'react';
import {Button, Empty, Popconfirm, Space, Table, Tag, Typography} from 'antd';
import {RollbackOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {useSession} from 'next-auth/react';
import type {SnapshotMeta} from '@services/features/Publishing/PublishService';
import {useViewModel} from '@client/lib/state/observable';
import {PublishingViewModel} from './PublishingViewModel';

/** Render-only Publishing pane — VM3 (2026-05-02). */
const AdminSettingsPublishing: React.FC = () => {
    const {t} = useTranslation();
    const {data: session} = useSession();
    const canPublish = Boolean((session?.user as any)?.canPublishProduction);
    const vm = useViewModel(() => new PublishingViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);

    const columns = [
        {title: t('Published'), dataIndex: 'publishedAt', key: 'publishedAt', width: 220,
            render: (iso: string, row: SnapshotMeta, index: number) => (
                <Space>
                    <Typography.Text>{new Date(iso).toLocaleString()}</Typography.Text>
                    {index === 0 && <Tag color="green">{t('Active')}</Tag>}
                    {row.rolledBackFrom && <Tag color="blue">{t('Rollback')}</Tag>}
                </Space>
            )},
        {title: t('By'), dataIndex: 'publishedBy', key: 'publishedBy', width: 180,
            render: (v: string) => v ?? <Typography.Text type="secondary">—</Typography.Text>},
        {title: t('Note'), dataIndex: 'note', key: 'note',
            render: (v: string) => v ?? <Typography.Text type="secondary">—</Typography.Text>},
        {title: t('Actions'), key: 'actions', width: 140,
            render: (_: unknown, row: SnapshotMeta, index: number) => (
                index === 0 ? null : (
                    <Popconfirm
                        title={t('Restore this snapshot?')}
                        description={t('A new snapshot will be created pointing at this version.')}
                        okText={t('Restore')}
                        cancelText={t('Cancel')}
                        disabled={!canPublish}
                        onConfirm={() => vm.rollback(row.id)}
                    >
                        <Button
                            size="small"
                            icon={<RollbackOutlined/>}
                            disabled={!canPublish}
                            loading={vm.rollingBack === row.id}
                        >
                            {t('Restore')}
                        </Button>
                    </Popconfirm>
                )
            )},
    ];

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center">
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                {!canPublish && (
                    <Typography.Text type="secondary">
                        {t('You need the "Can publish to production" permission to restore snapshots.')}
                    </Typography.Text>
                )}
            </Space>
            {vm.history.length === 0 && !vm.loading
                ? <Empty description={t('No snapshots yet — use the Publish button in App building to create one.')}/>
                : (
                    <Table
                        rowKey="id"
                        loading={vm.loading}
                        columns={columns as any}
                        dataSource={vm.history}
                        pagination={{pageSize: 20}}
                        size="middle"
                    />
                )}
        </div>
    );
};

export default AdminSettingsPublishing;
