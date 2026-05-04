import React, {useEffect} from 'react';
import {Button, Card, Empty, Skeleton, Space, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {ThingsToDoViewModel} from './ThingsToDoViewModel';

/**
 * Things-to-do panel — the simplified admin home. Renders a small
 * card for every actionable item the VM resolved. Per
 * `admin-ui-modes.md`: simplified mode is "what needs doing", not
 * "every feature pane".
 *
 * Render-only — VM owns refresh, item list, loading. Component
 * renders whatever resolved cleanly; gracefully degrades by
 * showing the empty state when no items are pending.
 */
const ThingsToDoPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ThingsToDoViewModel(undefined, undefined, undefined, undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);

    if (vm.loading && vm.items.length === 0) {
        return (
            <div style={{padding: 24}}>
                <Typography.Title level={3}>{t('Things to do')}</Typography.Title>
                <Skeleton active paragraph={{rows: 3}} />
            </div>
        );
    }

    const visible = vm.visibleItems;

    return (
        <div style={{padding: 24}}>
            <Typography.Title level={3}>{t('Things to do')}</Typography.Title>
            {visible.length === 0 ? (
                <Empty description={t('Nothing pending — you are all caught up.')} />
            ) : (
                <Space direction="vertical" size={12} style={{width: '100%'}}>
                    {visible.map(item => (
                        <Card key={item.kind} size="small" data-todo-kind={item.kind}>
                            <Space style={{width: '100%', justifyContent: 'space-between'}}>
                                <Space direction="vertical" size={2}>
                                    <Typography.Text strong>{item.title}</Typography.Text>
                                    <Typography.Text type="secondary">
                                        {t('{{count}} item(s)', {count: item.count})}
                                    </Typography.Text>
                                </Space>
                                <Button type="primary" href={item.href}>
                                    {t('Open')}
                                </Button>
                            </Space>
                        </Card>
                    ))}
                </Space>
            )}
        </div>
    );
};

export default ThingsToDoPanel;
