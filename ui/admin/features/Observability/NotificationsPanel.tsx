/**
 * W8f — Admin observability for customer notifications.
 *
 * Read-only: per-category routing breakdown across the customer base,
 * plus 24h inbox volume. Operator can spot "marketing opt-out rate
 * trending up" or "comment-reply backlog growing" at a glance.
 *
 * State lives in `NotificationsObservabilityViewModel` per VM3 — admin
 * features must NOT use raw `useState`.
 */
import React, {useEffect} from 'react';
import {Button, Card, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {notifyPromise} from '@admin/lib/notify';
import EmptyState from '@admin/lib/EmptyState';
import {NotificationsObservabilityViewModel, type PerCategoryRow} from './NotificationsViewModel';

const AdminNotificationsPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new NotificationsObservabilityViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const handleRefresh = (): void => {
        void notifyPromise(vm.refresh(), {
            loading: t('notifications.stats.loading'),
            success: t('notifications.stats.loaded'),
            error: t('notifications.stats.error'),
        });
    };

    const columns = [
        {title: t('notifications.cat'), dataIndex: 'category', key: 'category',
            render: (c: string) => <Typography.Text code style={{fontSize: 12}} data-testid={`notif-stats-cat-${c}`}>{c}</Typography.Text>},
        {title: t('notifications.routing.both'), dataIndex: 'both', key: 'both', width: 100,
            render: (n: number) => <Tag color="green">{n}</Tag>},
        {title: t('notifications.routing.email'), dataIndex: 'email', key: 'email', width: 100,
            render: (n: number) => <Tag color="blue">{n}</Tag>},
        {title: t('notifications.routing.inbox'), dataIndex: 'inbox', key: 'inbox', width: 100,
            render: (n: number) => <Tag color="gold">{n}</Tag>},
        {title: t('notifications.routing.off'), dataIndex: 'off', key: 'off', width: 100,
            render: (n: number) => <Tag color="red">{n}</Tag>},
    ];

    const stats = vm.stats;

    return (
        <div style={{padding: 16}} data-testid="admin-notifications-panel">
            <Card
                title={t('notifications.stats.title')}
                extra={
                    <Button
                        onClick={handleRefresh}
                        loading={vm.loading}
                        data-testid="notif-stats-refresh"
                    >{t('Refresh')}</Button>
                }
            >
                {stats ? (
                    <>
                        <div style={{marginBottom: 12}}>
                            <Typography.Text data-testid="notif-stats-customers">
                                {t('notifications.stats.customers', {count: stats.customers})}
                            </Typography.Text>{' · '}
                            <Typography.Text data-testid="notif-stats-recent">
                                {t('notifications.stats.recent24h', {count: stats.recentInboxCount})}
                            </Typography.Text>
                        </div>
                        <Table<PerCategoryRow>
                            rowKey="category"
                            size="small"
                            dataSource={stats.perCategory}
                            columns={columns as any}
                            pagination={false}
                        />
                    </>
                ) : (
                    <EmptyState
                        testId="notif-stats-empty"
                        title={t('notifications.stats.empty.title')}
                        description={t('notifications.stats.empty.description')}
                    />
                )}
            </Card>
        </div>
    );
};

export default AdminNotificationsPanel;
