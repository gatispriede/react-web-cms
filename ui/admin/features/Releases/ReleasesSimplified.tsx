/**
 * Releases — simplified pane.
 *
 * List + create + attach + publish. Per the AUI mode hierarchy:
 * simplified covers the happy-path editorial flow. The Advanced view
 * adds rollback + perspective preview.
 */
import React, {useEffect} from 'react';
import {Button, Empty, Input, List, Popconfirm, Select, Space, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {ReleasesViewModel, RELEASE_ENTITY_OPTIONS} from './ReleasesViewModel';
import type {ReleaseEntityKind, ReleaseMember} from '@interfaces/IRelease';

const STATUS_COLOR: Record<string, string> = {
    'draft': 'default',
    'publishing': 'processing',
    'published': 'success',
    'failed': 'error',
    'rolled-back': 'warning',
};

const ReleasesSimplified: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ReleasesViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    const memberColumns = [
        {title: t('Entity'), dataIndex: 'entity', key: 'entity', render: (v: string) => <Tag>{v}</Tag>},
        {title: t('Id'), dataIndex: 'id', key: 'id', render: (v: string) => <Typography.Text code>{v}</Typography.Text>},
        {title: t('Label'), dataIndex: 'label', key: 'label'},
        {
            title: t('Actions'), key: 'a', width: 80,
            render: (_: unknown, row: ReleaseMember) => (
                <Button
                    size="small"
                    data-testid={`release-member-detach-${row.entity}-${row.id}`}
                    onClick={() => void vm.detach(row.entity, row.id)}
                >{t('Remove')}</Button>
            ),
        },
    ];

    return (
        <Space orientation="vertical" size="large" style={{width: '100%', padding: 16}} data-testid="releases-pane">
            <Typography.Title level={4} style={{margin: 0}}>{t('Content Releases')}</Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('Group N draft changes, preview together, publish atomically.')}
            </Typography.Paragraph>

            <Space orientation="vertical" style={{width: '100%'}}>
                <Typography.Text strong>{t('Create release')}</Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 600}}>
                    <Input
                        data-testid="release-create-title"
                        placeholder={t('Release title')}
                        value={vm.createTitle}
                        onChange={e => vm.setCreateTitle(e.target.value)}
                    />
                    <Button
                        type="primary"
                        data-testid="release-create-submit"
                        loading={vm.saving}
                        onClick={() => void vm.create()}
                    >{t('Create')}</Button>
                </Space.Compact>
            </Space>

            <div style={{display: 'flex', gap: 16, width: '100%'}}>
                <div style={{minWidth: 260, flex: '0 0 260px'}}>
                    <Typography.Text strong>{t('Releases')}</Typography.Text>
                    <List
                        data-testid="release-list"
                        size="small"
                        bordered
                        loading={vm.loading}
                        dataSource={vm.list}
                        locale={{emptyText: <Empty description={t('No releases yet')}/>}}
                        renderItem={r => (
                            <List.Item
                                data-testid={`release-list-item-${r.id}`}
                                onClick={() => void vm.select(r.id)}
                                style={{cursor: 'pointer', background: vm.selected?.id === r.id ? '#fafafa' : undefined}}
                            >
                                <Space direction="vertical" size={0} style={{width: '100%'}}>
                                    <Space>
                                        <span>{r.title}</span>
                                        <Tag color={STATUS_COLOR[r.status]}>{r.status}</Tag>
                                    </Space>
                                    <Typography.Text type="secondary" style={{fontSize: 11}}>
                                        {r.memberCount} {t('members')}
                                    </Typography.Text>
                                </Space>
                            </List.Item>
                        )}
                    />
                </div>

                <div style={{flex: 1, minWidth: 0}}>
                    {!vm.selected ? (
                        <Empty description={t('Select a release to manage members')}/>
                    ) : (
                        <Space orientation="vertical" style={{width: '100%'}} size="middle">
                            <Space>
                                <Typography.Title level={5} style={{margin: 0}}>{vm.selected.title}</Typography.Title>
                                <Tag color={STATUS_COLOR[vm.selected.status]} data-testid="release-detail-status">
                                    {vm.selected.status}
                                </Tag>
                            </Space>

                            {(vm.selected.status === 'draft' || vm.selected.status === 'failed') && (
                                <Space>
                                    <Select<ReleaseEntityKind>
                                        data-testid="release-attach-entity"
                                        style={{width: 140}}
                                        value={vm.attachEntity}
                                        onChange={v => vm.setAttachEntity(v)}
                                        options={RELEASE_ENTITY_OPTIONS}
                                    />
                                    <Input
                                        data-testid="release-attach-id"
                                        placeholder={t('Entity id')}
                                        value={vm.attachId}
                                        onChange={e => vm.setAttachId(e.target.value)}
                                        style={{width: 260}}
                                    />
                                    <Button
                                        data-testid="release-attach-submit"
                                        onClick={() => void vm.attach()}
                                        loading={vm.saving}
                                    >{t('Attach')}</Button>
                                </Space>
                            )}

                            <Table
                                rowKey={(r: ReleaseMember) => `${r.entity}:${r.id}`}
                                columns={memberColumns as any}
                                dataSource={vm.selected.members}
                                pagination={false}
                                size="small"
                                locale={{emptyText: t('No members yet — attach a draft above')}}
                            />

                            <Space>
                                <Popconfirm
                                    title={t('Publish this release?')}
                                    description={t('All attached members will be written to live atomically.')}
                                    okText={t('Publish')}
                                    okButtonProps={{danger: true, 'data-testid': 'release-publish-confirm'} as any}
                                    onConfirm={() => void vm.publish()}
                                    disabled={vm.selected.members.length === 0 || (vm.selected.status !== 'draft' && vm.selected.status !== 'failed')}
                                >
                                    <Button
                                        type="primary"
                                        danger
                                        data-testid="release-publish-button"
                                        loading={vm.saving}
                                        disabled={vm.selected.members.length === 0 || (vm.selected.status !== 'draft' && vm.selected.status !== 'failed')}
                                    >{t('Publish')}</Button>
                                </Popconfirm>
                                <Popconfirm
                                    title={t('Delete this release?')}
                                    onConfirm={() => void vm.deleteRelease(vm.selected!.id)}
                                    okText={t('Delete')}
                                    cancelText={t('Cancel')}
                                >
                                    <Button data-testid="release-delete-button" disabled={vm.selected.status === 'publishing'}>
                                        {t('Delete')}
                                    </Button>
                                </Popconfirm>
                                {vm.selected.lastError && (
                                    <Typography.Text type="danger" data-testid="release-last-error">
                                        {vm.selected.lastError}
                                    </Typography.Text>
                                )}
                            </Space>
                        </Space>
                    )}
                </div>
            </div>
        </Space>
    );
};

export default ReleasesSimplified;
