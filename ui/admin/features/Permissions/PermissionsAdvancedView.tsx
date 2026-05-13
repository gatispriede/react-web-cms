import React from 'react';
import {Button, Collapse, Input, Select, Space, Table, Tag} from 'antd';
import {DeleteOutlined, PlusOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {PermissionsViewModel} from './PermissionsViewModel';
import PermissionsSimplifiedView from './PermissionsSimplifiedView';

/**
 * Advanced Permissions pane — composes the Simplified base + adds:
 *   - Per-resource override disclosure (engine `(scope, resourceId)` rows
 *     with specific ids — e.g. one page's slug, one module instance)
 *   - "Custom grants" disclosure exposing the raw row table for the
 *     editing user (fallback when the tier model doesn't fit)
 *
 * Per AUI mode hierarchy (2026-05-07) — advanced composes simplified via
 * the `renderEditorExtra` slot, sharing a single VM so the tier grid and
 * override panel mutate the same state.
 */
const PermissionsAdvancedView: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new PermissionsViewModel(undefined, undefined, t));

    const renderEditorExtra = (sharedVm: PermissionsViewModel) => (
        <PerResourcePanel vm={sharedVm}/>
    );

    return (
        <PermissionsSimplifiedView
            vm={vm}
            mode="advanced"
            renderEditorExtra={renderEditorExtra}
        />
    );
};

const SCOPE_OPTIONS = [
    {value: 'page', label: 'page'},
    {value: 'module', label: 'module'},
    {value: 'element', label: 'element'},
];

const PerResourcePanel: React.FC<{vm: PermissionsViewModel}> = ({vm}) => {
    const {t} = useTranslation();
    const editing = vm.editing;
    if (!editing) return null;
    const {scope, resourceId} = vm.overrideDraft;
    const setScope = (v: string) => vm.setOverrideDraftScope(v);
    const setResourceId = (v: string) => vm.setOverrideDraftResource(v);

    const rows = vm.grants
        .filter(g => g.userId === editing.userId && g.resourceId !== '*')
        .map(g => ({...g, key: `${g.scope}:${g.resourceId}`}));

    const columns = [
        {title: t('Scope'), dataIndex: 'scope', key: 'scope'},
        {title: t('Resource'), dataIndex: 'resourceId', key: 'resourceId'},
        {
            title: t('Actions'),
            key: 'actions',
            width: 100,
            render: (_: unknown, row: typeof rows[number]) => (
                <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined/>}
                    data-testid={`permissions-override-${row.scope}-${row.resourceId}-revoke-button`}
                    onClick={() => vm.revokeOverride(editing.userId, row.scope, row.resourceId)}
                >{t('Revoke')}</Button>
            ),
        },
    ];

    const onAdd = async () => {
        if (!resourceId.trim()) return;
        await vm.grantOverride(editing.userId, scope, resourceId.trim());
        vm.resetOverrideDraft();
    };

    return (
        <Collapse
            style={{marginTop: 16}}
            items={[
                {
                    key: 'overrides',
                    label: t('permissions.overrides.heading'),
                    children: (
                        <>
                            <Table
                                size="small"
                                rowKey="key"
                                dataSource={rows}
                                columns={columns}
                                pagination={false}
                                locale={{emptyText: t('permissions.overrides.empty')}}
                                data-testid="permissions-overrides-table"
                            />
                            <Space style={{marginTop: 12}}>
                                <Select
                                    value={scope}
                                    onChange={setScope}
                                    options={SCOPE_OPTIONS}
                                    style={{width: 140}}
                                    data-testid="permissions-override-scope-select"
                                />
                                <Input
                                    placeholder={t('permissions.overrides.resourcePlaceholder')}
                                    value={resourceId}
                                    onChange={e => setResourceId(e.target.value)}
                                    style={{width: 280}}
                                    data-testid="permissions-override-resource-input"
                                />
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined/>}
                                    onClick={onAdd}
                                    data-testid="permissions-override-add-button"
                                >{t('permissions.overrides.add')}</Button>
                            </Space>
                        </>
                    ),
                },
                {
                    key: 'custom',
                    label: t('permissions.custom.heading'),
                    children: (
                        <Tag color="default" data-testid="permissions-custom-disclosure">
                            {t('permissions.custom.legacyNote')}
                        </Tag>
                    ),
                },
            ]}
        />
    );
};

export default PermissionsAdvancedView;
