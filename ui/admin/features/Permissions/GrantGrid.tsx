import React from 'react';
import {Button, Empty, Popover, Select, Space, Tag} from 'antd';
import {CheckCircleOutlined, DeleteOutlined, PlusOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {PermissionsViewModel} from './PermissionsViewModel';
import {GrantDimension, GRANT_DIMENSIONS} from './tierMapping';

/**
 * Grant-grid editor — the richer UX for the Q10 three-dimension `Grant`
 * union (feature / page / locale), per
 * `docs/roadmap/admin/admin-permissions-ux.md`.
 *
 * Shape: one section per dimension. Each section is a grid of toggle
 * cells — one per catalogued resource (feature flag / page slug / locale
 * code). A granted cell is filled + clickable into a **per-resource
 * overlay** (Popover) showing grant detail + a revoke action; an
 * un-granted cell is an outline toggle. An "add" Select lets operators
 * grant a resource that isn't already on the grid surface.
 *
 * Replaces the three flat free-position multi-selects the Users pane
 * uses — the grid makes "who can touch what" scannable at a glance and
 * gives every grant its own addressable overlay.
 *
 * Persistence is per-cell-immediate (see `PermissionsViewModel.toggleGrant`)
 * — no separate save step for the grant grid.
 */

const DIMENSION_META: Record<GrantDimension, {icon: string; color: string}> = {
    feature: {icon: '🧩', color: 'geekblue'},
    page: {icon: '📄', color: 'green'},
    locale: {icon: '🌐', color: 'gold'},
};

interface Props {
    vm: PermissionsViewModel;
}

const GrantGrid: React.FC<Props> = ({vm}) => {
    const {t} = useTranslation();
    const editing = vm.editing;
    if (!editing) return null;

    return (
        <div data-testid="permissions-grant-grid" style={{marginTop: 20}}>
            <div style={{marginBottom: 8, fontWeight: 500}}>
                {t('permissions.grantGrid.heading')}
            </div>
            <div style={{marginBottom: 12, color: '#888', fontSize: 12}}>
                {t('permissions.grantGrid.help')}
            </div>
            {GRANT_DIMENSIONS.map((dimension) => (
                <GrantDimensionSection
                    key={dimension}
                    vm={vm}
                    dimension={dimension}
                    userId={editing.userId}
                />
            ))}
        </div>
    );
};

interface SectionProps {
    vm: PermissionsViewModel;
    dimension: GrantDimension;
    userId: string;
}

const GrantDimensionSection: React.FC<SectionProps> = ({vm, dimension, userId}) => {
    const {t} = useTranslation();
    const meta = DIMENSION_META[dimension];
    const catalogue = vm.cataloguesFor(dimension);

    // The grid surface: every catalogued resource, plus any granted
    // resource that isn't in the catalogue (stale flag, deleted page —
    // still show it so the operator can revoke it).
    const grantedIds = vm.grantGridRowsFor(userId)
        .filter(g => g.scope === dimension)
        .map(g => g.resourceId);
    const surfaceIds = Array.from(new Set([...catalogue, ...grantedIds])).sort();

    // "Add" options — catalogued resources not currently granted.
    const addOptions = catalogue
        .filter(id => !grantedIds.includes(id))
        .map(id => ({label: id, value: id}));

    return (
        <div
            data-testid={`permissions-grant-grid-section-${dimension}`}
            style={{marginBottom: 20}}
        >
            <div style={{marginBottom: 8}}>
                <Tag color={meta.color}>
                    {meta.icon} {t(`permissions.grantGrid.dimension.${dimension}`)}
                </Tag>
                <span style={{color: '#999', fontSize: 12, marginLeft: 4}}>
                    {t('permissions.grantGrid.grantedCount', {count: grantedIds.length})}
                </span>
            </div>

            {surfaceIds.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('permissions.grantGrid.emptyDimension')}
                    data-testid={`permissions-grant-grid-empty-${dimension}`}
                    style={{margin: '8px 0'}}
                />
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                    }}
                >
                    {surfaceIds.map((resourceId) => (
                        <GrantCell
                            key={resourceId}
                            vm={vm}
                            dimension={dimension}
                            userId={userId}
                            resourceId={resourceId}
                        />
                    ))}
                </div>
            )}

            {addOptions.length > 0 && (
                <Space style={{marginTop: 10}}>
                    <Select
                        data-testid={`permissions-grant-grid-add-select-${dimension}`}
                        showSearch
                        allowClear
                        style={{width: 260}}
                        placeholder={t('permissions.grantGrid.addPlaceholder')}
                        options={addOptions}
                        optionFilterProp="label"
                        value={null}
                        onSelect={(value: string | null) => {
                            if (value) void vm.toggleGrant(userId, dimension, value);
                        }}
                    />
                </Space>
            )}
        </div>
    );
};

interface CellProps {
    vm: PermissionsViewModel;
    dimension: GrantDimension;
    userId: string;
    resourceId: string;
}

const GrantCell: React.FC<CellProps> = ({vm, dimension, userId, resourceId}) => {
    const {t} = useTranslation();
    const granted = vm.hasGrant(userId, dimension, resourceId);
    const pending = vm.isCellPending(userId, dimension, resourceId);
    const testId = `permissions-grant-cell-${dimension}-${resourceId}`;

    const cellButton = (
        <Button
            size="small"
            type={granted ? 'primary' : 'default'}
            icon={granted ? <CheckCircleOutlined/> : <PlusOutlined/>}
            loading={pending}
            data-testid={testId}
            data-state={granted ? 'granted' : 'ungranted'}
            onClick={() => {
                // Un-granted cell → grant immediately. Granted cell →
                // the Popover handles it (it opens the overlay).
                if (!granted) void vm.toggleGrant(userId, dimension, resourceId);
            }}
        >
            {resourceId}
        </Button>
    );

    if (!granted) return cellButton;

    // Granted cells get the per-resource overlay.
    const open = vm.overlay?.dimension === dimension
        && vm.overlay?.resourceId === resourceId;
    const row = open ? vm.overlayRow() : undefined;

    return (
        <Popover
            open={open}
            trigger="click"
            onOpenChange={(next) => {
                if (next) vm.openOverlay(dimension, resourceId);
                else vm.closeOverlay();
            }}
            data-testid={`permissions-grant-overlay-${dimension}-${resourceId}`}
            title={
                <span data-testid={`permissions-grant-overlay-title-${dimension}-${resourceId}`}>
                    {t(`permissions.grantGrid.dimension.${dimension}`)} · {resourceId}
                </span>
            }
            content={
                <div style={{maxWidth: 260}}>
                    <div style={{fontSize: 12, color: '#888', marginBottom: 8}}>
                        {row?.grantedBy
                            ? t('permissions.grantGrid.grantedBy', {who: row.grantedBy})
                            : t('permissions.grantGrid.grantedByUnknown')}
                        {row?.grantedAt ? ` · ${new Date(row.grantedAt).toLocaleString()}` : ''}
                    </div>
                    <Button
                        size="small"
                        danger
                        block
                        icon={<DeleteOutlined/>}
                        loading={pending}
                        data-testid={`permissions-grant-overlay-revoke-${dimension}-${resourceId}`}
                        onClick={() => { void vm.revokeFromOverlay(); }}
                    >
                        {t('permissions.grantGrid.revoke')}
                    </Button>
                </div>
            }
        >
            {cellButton}
        </Popover>
    );
};

export default GrantGrid;
