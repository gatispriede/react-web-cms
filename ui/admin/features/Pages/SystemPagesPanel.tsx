/**
 * Phase 1.D — SystemPagesPanel admin pane.
 *
 * Lists registered system pages with status (default vs operator-edited
 * via fingerprint) and offers a Reset-to-default action (Sonner
 * destructive confirm). VM4 — admin features must not use `useState`.
 */
import React, {useEffect} from 'react';
import {Button, Card, Empty, Space, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {SystemPagesViewModel, type SystemPageRow} from './SystemPagesViewModel';

const SystemPagesPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new SystemPagesViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const columns = [
        {title: t('System key'), dataIndex: 'systemKey', key: 'systemKey', render: (v: string) => <Typography.Text code data-testid={`system-page-key-${v}`}>{v}</Typography.Text>},
        {title: t('Slug'), dataIndex: 'slug', key: 'slug'},
        {title: t('Access gate'), dataIndex: 'accessGate', key: 'accessGate', render: (v: string) => <Tag>{v}</Tag>},
        {
            title: t('Status'),
            key: 'status',
            render: (_: unknown, row: SystemPageRow) => {
                if (!row.state?.exists) return <Tag color="default" data-testid={`system-page-status-${row.systemKey}`}>not-bootstrapped</Tag>;
                if (row.state.operatorEdited) return <Tag color="processing" data-testid={`system-page-status-${row.systemKey}`}>operator-edited</Tag>;
                return <Tag color="success" data-testid={`system-page-status-${row.systemKey}`}>default</Tag>;
            },
        },
        {
            title: t('Actions'),
            key: 'actions',
            render: (_: unknown, row: SystemPageRow) => (
                <Button
                    size="small"
                    danger
                    loading={vm.resettingKey === row.systemKey}
                    onClick={() => void vm.reset(row.systemKey)}
                    data-testid={`system-page-reset-${row.systemKey}`}
                >
                    {t('Reset to default')}
                </Button>
            ),
        },
    ];

    return (
        <div className="system-pages-panel" data-testid="system-pages-panel">
            <Typography.Title level={3}>{t('System pages')}</Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('Framework-required pages (cart, checkout flow, order-by-token, account dashboard, magic-link verify). Operator edits to composable sections are preserved; locked transactional sections always remain.')}
            </Typography.Paragraph>
            <Space style={{marginBottom: 12}}>
                <Button onClick={() => void vm.refresh()} loading={vm.loading} data-testid="system-pages-refresh">
                    {t('Refresh')}
                </Button>
            </Space>
            {vm.rows.length === 0 && !vm.loading ? (
                <Card><Empty description={t('No system pages registered')} data-testid="system-pages-empty" /></Card>
            ) : (
                <Table
                    rowKey="systemKey"
                    columns={columns}
                    dataSource={[...vm.rows]}
                    pagination={false}
                    size="small"
                    data-testid="system-pages-table"
                />
            )}
        </div>
    );
};

export default SystemPagesPanel;
export {SystemPagesPanel};
