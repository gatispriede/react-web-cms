import React, {useCallback, useEffect, useState} from 'react';
import {Button, Empty, Popconfirm, Space, Table, Tag, Typography, message} from 'antd';
import {RollbackOutlined} from '../../common/icons';
import {useTranslation} from 'react-i18next';
import {useSession} from 'next-auth/react';
import PublishApi from '../../../api/PublishApi';
import type {SnapshotMeta} from '../../../../Server/PublishService';

const publishApi = new PublishApi();

const AdminSettingsPublishing: React.FC = () => {
    const {t} = useTranslation();
    const {data: session} = useSession();
    const canPublish = Boolean((session?.user as any)?.canPublishProduction);

    const [history, setHistory] = useState<SnapshotMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [rollingBack, setRollingBack] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setHistory(await publishApi.getHistory(100));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const rollback = async (id: string) => {
        setRollingBack(id);
        try {
            const result = await publishApi.rollback(id);
            if (result.error) { message.error(result.error); return; }
            message.success(t('Rolled back — new snapshot created.'));
            await refresh();
        } finally {
            setRollingBack(null);
        }
    };

    const columns = [
        {
            title: t('Published'),
            dataIndex: 'publishedAt',
            key: 'publishedAt',
            width: 220,
            render: (iso: string, row: SnapshotMeta, index: number) => (
                <Space>
                    <Typography.Text>{new Date(iso).toLocaleString()}</Typography.Text>
                    {index === 0 && <Tag color="green">{t('Active')}</Tag>}
                    {row.rolledBackFrom && <Tag color="blue">{t('Rollback')}</Tag>}
                </Space>
            ),
        },
        {title: t('By'), dataIndex: 'publishedBy', key: 'publishedBy', width: 180, render: (v: string) => v ?? <Typography.Text type="secondary">—</Typography.Text>},
        {title: t('Note'), dataIndex: 'note', key: 'note', render: (v: string) => v ?? <Typography.Text type="secondary">—</Typography.Text>},
        {
            title: t('Actions'),
            key: 'actions',
            width: 140,
            render: (_: unknown, row: SnapshotMeta, index: number) => (
                index === 0 ? null : (
                    <Popconfirm
                        title={t('Restore this snapshot?')}
                        description={t('A new snapshot will be created pointing at this version.')}
                        okText={t('Restore')}
                        cancelText={t('Cancel')}
                        disabled={!canPublish}
                        onConfirm={() => rollback(row.id)}
                    >
                        <Button
                            size="small"
                            icon={<RollbackOutlined/>}
                            disabled={!canPublish}
                            loading={rollingBack === row.id}
                        >
                            {t('Restore')}
                        </Button>
                    </Popconfirm>
                )
            ),
        },
    ];

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center">
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
                {!canPublish && (
                    <Typography.Text type="secondary">
                        {t('You need the "Can publish to production" permission to restore snapshots.')}
                    </Typography.Text>
                )}
            </Space>
            {history.length === 0 && !loading
                ? <Empty description={t('No snapshots yet — use the Publish button in App building to create one.')}/>
                : (
                    <Table
                        rowKey="id"
                        loading={loading}
                        columns={columns as any}
                        dataSource={history}
                        pagination={{pageSize: 20}}
                        size="middle"
                    />
                )}
        </div>
    );
};

export default AdminSettingsPublishing;
