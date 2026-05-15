import React, {ReactNode, useEffect} from 'react';
import {Button, Modal, Radio, Select, Tag} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {EditOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminCrudListModule from '@admin/modules/shapes/AdminCrudListModule';
import {IUser} from '@interfaces/IUser';
import {PermissionsViewModel} from './PermissionsViewModel';
import {ROLE_PRESETS} from './rolePresets';
import {SCOPE_ORDER, TIER_ORDER, Tier, ScopeKey} from './tierMapping';
import GrantGrid from './GrantGrid';

/**
 * Simplified Permissions pane — tier grid + role preset picker.
 *
 * Per `aui-mode-hierarchy.md` (2026-05-07) this is the **base
 * component**: the advanced view composes it via `headerExtra` +
 * `renderEditorExtra` slots and an optional shared `vm`. Cards keep
 * stable `permissions-row-{id}` testids so e2e specs target the same
 * surface in both modes.
 *
 * UX shape per `docs/roadmap/admin/admin-permissions-ux.md`:
 *   - 4 tiers — Full / Edit / Comment / View — radio buttons per scope
 *   - Role presets (Admin / Designer / Editor / Reviewer / Viewer)
 *   - Per-resource override + Custom-grants disclosure live in
 *     PermissionsAdvancedView (advanced mode only)
 *
 * admin-module-composed: the bespoke user-list table + toolbar + empty
 * state are now the generic `AdminCrudListModule` shape; the tier-grid
 * editor Modal stays here as a bridge-owned bespoke surface. Reached via
 * `AdminPageDispatch` — see `PermissionsAdminLoader` / `PermissionsAdminUILoader`.
 */

interface Props {
    headerExtra?: ReactNode;
    /** Slot for the advanced view to inject the per-resource override
     *  panel into the editor modal. */
    renderEditorExtra?: (vm: PermissionsViewModel) => ReactNode;
    vm?: PermissionsViewModel;
    mode?: 'simplified' | 'advanced';
    children?: ReactNode;
}

const PermissionsSimplifiedView: React.FC<Props> = ({
    headerExtra,
    renderEditorExtra,
    vm: vmProp,
    mode = 'simplified',
    children,
}) => {
    const {t} = useTranslation();
    const ownVm = useViewModel(() => new PermissionsViewModel(undefined, undefined, t));
    const vm = vmProp ?? ownVm;

    useEffect(() => { void vm.refresh(); }, [vm]);

    const presetOptions = vm.presets.map(p => ({
        value: p.id,
        label: t(p.labelKey),
    }));

    const tierColor: Record<Tier, string> = {
        Full: 'volcano',
        Edit: 'blue',
        Comment: 'purple',
        View: 'default',
    };

    const columns = [
        {title: t('Email'), dataIndex: 'email', key: 'email'},
        {title: t('Name'), dataIndex: 'name', key: 'name'},
        {
            title: t('Role'),
            dataIndex: 'role',
            key: 'role',
            render: (role: string = 'viewer') => <Tag>{t(role)}</Tag>,
        },
        {
            title: t('permissions.grants.count'),
            key: 'grants',
            render: (_: unknown, user: IUser) => (
                <Tag color="cyan">{vm.grantCountFor(user.id)}</Tag>
            ),
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 140,
            render: (_: unknown, user: IUser) => (
                <Button
                    size="small"
                    icon={<EditOutlined/>}
                    data-testid={`permissions-${mode}-row-${user.id}-edit-button`}
                    onClick={() => vm.openEdit(user)}
                >{t('Manage')}</Button>
            ),
        },
    ];

    return (
        <div data-testid={`permissions-${mode}-pane`}>
            <AdminCrudListModule
                testId={`permissions-${mode}-list`}
                columns={columns as unknown as ColumnsType<Record<string, unknown>>}
                rows={vm.users as unknown as Record<string, unknown>[]}
                rowKey="id"
                loading={vm.loading}
                pageSize={10}
                onRefresh={() => vm.refresh()}
                refreshTestId="permissions-refresh-button"
                headerExtra={headerExtra}
                rowTestId={(row) => `permissions-row-${(row as unknown as IUser).id}`}
                emptyState={{
                    testId: `permissions-${mode}-empty-state`,
                    title: t('empty.permissions.title'),
                    description: t('empty.permissions.description'),
                    art: 'users',
                    primary: {
                        label: t('empty.permissions.primary'),
                        onClick: () => vm.refresh(),
                        testId: `permissions-${mode}-empty-state-primary`,
                    },
                }}
                showEmptyState={vm.users.length === 0 && !vm.loading}
            />
            {vm.editing !== null && (
                <Modal
                    data-testid="permissions-editor-modal"
                    title={t('permissions.editor.title', {email: vm.editing.userEmail})}
                    open
                    onCancel={() => vm.close()}
                    onOk={() => vm.save()}
                    confirmLoading={vm.saving}
                    okText={t('Save')}
                    width={720}
                    destroyOnClose
                >
                    <div style={{marginBottom: 16}}>
                        <div style={{marginBottom: 4, fontWeight: 500}}>{t('permissions.preset.label')}</div>
                        <Select
                            data-testid="permissions-preset-select"
                            value={vm.editing.preset}
                            onChange={(v) => vm.applyPreset(v)}
                            options={presetOptions}
                            style={{width: '100%'}}
                        />
                        <div style={{marginTop: 6, color: '#888', fontSize: 12}}>
                            {(() => {
                                const p = ROLE_PRESETS.find(x => x.id === vm.editing?.preset);
                                return p ? t(p.descriptionKey) : '';
                            })()}
                        </div>
                    </div>

                    <div style={{marginBottom: 8, fontWeight: 500}}>
                        {t('permissions.tierGrid.heading')}
                    </div>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                            <tr>
                                <th style={{textAlign: 'left', padding: 8}}>{t('Scope')}</th>
                                {TIER_ORDER.map(tier => (
                                    <th key={tier} style={{textAlign: 'center', padding: 8}}>
                                        <Tag color={tierColor[tier]}>{t(`permissions.tier.${tier}`)}</Tag>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {SCOPE_ORDER.map((scope: ScopeKey) => (
                                <tr key={scope} data-testid={`permissions-scope-row-${scope}`}>
                                    <td style={{padding: 8}}>{t(`permissions.scope.${scope}`)}</td>
                                    {TIER_ORDER.map(tier => (
                                        <td key={tier} style={{textAlign: 'center', padding: 8}}>
                                            <Radio
                                                checked={vm.editing?.tiers[scope] === tier}
                                                onChange={() => vm.setTier(scope, tier)}
                                                data-testid={`permissions-${scope}-${tier}-radio`}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Grant-grid — feature/page/locale dimension grants.
                        The richer UX per `admin-permissions-ux.md`: a
                        toggle grid + per-resource overlays, replacing the
                        Users pane's three flat multi-selects. Persists
                        per-cell-immediate (no separate save step). */}
                    <GrantGrid vm={vm}/>

                    {renderEditorExtra?.(vm)}
                </Modal>
            )}
            {children}
        </div>
    );
};

export default PermissionsSimplifiedView;
