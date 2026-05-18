/**
 * Releases — advanced pane.
 *
 * Mirrors the Simplified pane and adds rollback + perspective preview
 * controls. Per the AUI mode hierarchy: the advanced view IS the
 * superset; sharing the simplified component would require a shared
 * VM instance — instead the simplified pane is a strict subset, and
 * the advanced pane re-renders the same VM with the extra controls.
 */
import React, {useEffect} from 'react';
import {Alert, Button, Card, Descriptions, Empty, Input, List, Popconfirm, Select, Space, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {ReleasesViewModel, RELEASE_ENTITY_OPTIONS} from './ReleasesViewModel';
import type {ReleaseEntityKind, ReleaseMember} from '@interfaces/IRelease';

const STATUS_COLOR: Record<string, string> = {
    'draft': 'default', 'publishing': 'processing', 'published': 'success', 'failed': 'error', 'rolled-back': 'warning',
};

const ReleasesAdvanced: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ReleasesViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    const memberColumns = [
        {title: t('Entity'), dataIndex: 'entity', key: 'entity', render: (v: string) => <Tag>{v}</Tag>},
        {title: t('Id'), dataIndex: 'id', key: 'id', render: (v: string) => <Typography.Text code>{v}</Typography.Text>},
        {title: t('Label'), dataIndex: 'label', key: 'label'},
        {title: t('Pre-release?'), dataIndex: 'preReleaseSnapshot', key: 'pre', render: (v: unknown) => v ? <Tag>update</Tag> : <Tag color="green">create</Tag>},
        {
            title: t('Actions'), key: 'a', width: 80,
            render: (_: unknown, row: ReleaseMember) => (
                <Button size="small" data-testid={`release-member-detach-${row.entity}-${row.id}`} onClick={() => void vm.detach(row.entity, row.id)}>{t('Remove')}</Button>
            ),
        },
    ];

    const mutable = vm.selected?.status === 'draft' || vm.selected?.status === 'failed';

    return (
        <Space orientation="vertical" size="large" style={{width: '100%', padding: 16}} data-testid="releases-pane-advanced">
            <Typography.Title level={4} style={{margin: 0}}>{t('Content Releases')} — {t('Advanced')}</Typography.Title>

            <Space orientation="vertical" style={{width: '100%'}}>
                <Typography.Text strong>{t('Create release')}</Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 600}}>
                    <Input data-testid="release-create-title" placeholder={t('Release title')} value={vm.createTitle} onChange={e => vm.setCreateTitle(e.target.value)}/>
                    <Input data-testid="release-create-description" placeholder={t('Description (optional)')} value={vm.createDescription} onChange={e => vm.setCreateDescription(e.target.value)}/>
                    <Button type="primary" data-testid="release-create-submit" loading={vm.saving} onClick={() => void vm.create()}>{t('Create')}</Button>
                </Space.Compact>
            </Space>

            <div style={{display: 'flex', gap: 16, width: '100%'}}>
                <div style={{minWidth: 280, flex: '0 0 280px'}}>
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
                                    <Typography.Text type="secondary" style={{fontSize: 11}}>{r.memberCount} {t('members')} · v{r.version}</Typography.Text>
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
                            <Card size="small" data-testid="release-detail-card">
                                <Descriptions size="small" column={2}>
                                    <Descriptions.Item label={t('Title')}>{vm.selected.title}</Descriptions.Item>
                                    <Descriptions.Item label={t('Status')}><Tag color={STATUS_COLOR[vm.selected.status]} data-testid="release-detail-status">{vm.selected.status}</Tag></Descriptions.Item>
                                    <Descriptions.Item label={t('Members')}>{vm.selected.members.length}</Descriptions.Item>
                                    <Descriptions.Item label={t('Version')}>{vm.selected.version}</Descriptions.Item>
                                    {vm.selected.publishedAt && <Descriptions.Item label={t('Published')}>{vm.selected.publishedAt}</Descriptions.Item>}
                                    {vm.selected.rollbackOf && <Descriptions.Item label={t('Rollback of')}><Typography.Text code>{vm.selected.rollbackOf}</Typography.Text></Descriptions.Item>}
                                </Descriptions>
                                {vm.selected.lastError && (
                                    <Alert type="error" showIcon style={{marginTop: 8}} message={vm.selected.lastError} data-testid="release-last-error"/>
                                )}
                            </Card>

                            {mutable && (
                                <Space>
                                    <Select<ReleaseEntityKind> data-testid="release-attach-entity" style={{width: 140}} value={vm.attachEntity} onChange={v => vm.setAttachEntity(v)} options={RELEASE_ENTITY_OPTIONS}/>
                                    <Input data-testid="release-attach-id" placeholder={t('Entity id')} value={vm.attachId} onChange={e => vm.setAttachId(e.target.value)} style={{width: 260}}/>
                                    <Button data-testid="release-attach-submit" onClick={() => void vm.attach()} loading={vm.saving}>{t('Attach draft')}</Button>
                                </Space>
                            )}

                            <Table rowKey={(r: ReleaseMember) => `${r.entity}:${r.id}`} columns={memberColumns as any} dataSource={vm.selected.members} pagination={false} size="small" locale={{emptyText: t('No members yet — attach a draft above')}}/>

                            <Space>
                                <Popconfirm
                                    title={t('Publish this release?')}
                                    description={t('All attached members will be written to live atomically.')}
                                    okText={t('Publish')}
                                    okButtonProps={{danger: true, 'data-testid': 'release-publish-confirm'} as any}
                                    onConfirm={() => void vm.publish()}
                                    disabled={!mutable || vm.selected.members.length === 0}
                                >
                                    <Button type="primary" danger data-testid="release-publish-button" loading={vm.saving} disabled={!mutable || vm.selected.members.length === 0}>{t('Publish')}</Button>
                                </Popconfirm>
                                <Popconfirm
                                    title={t('Roll this release back?')}
                                    description={t('All members will revert to their pre-release state via a new auto-published rollback release.')}
                                    okText={t('Roll back')}
                                    okButtonProps={{danger: true, 'data-testid': 'release-rollback-confirm'} as any}
                                    onConfirm={() => void vm.rollback()}
                                    disabled={vm.selected.status !== 'published'}
                                >
                                    <Button danger data-testid="release-rollback-button" disabled={vm.selected.status !== 'published'} loading={vm.saving}>{t('Rollback')}</Button>
                                </Popconfirm>
                                <Popconfirm title={t('Delete this release?')} onConfirm={() => void vm.deleteRelease(vm.selected!.id)} okText={t('Delete')} cancelText={t('Cancel')}>
                                    <Button data-testid="release-delete-button" disabled={vm.selected.status === 'publishing'}>{t('Delete')}</Button>
                                </Popconfirm>
                            </Space>
                        </Space>
                    )}
                </div>
            </div>
        </Space>
    );
};

export default ReleasesAdvanced;
