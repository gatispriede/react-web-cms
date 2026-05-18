/**
 * admin-module-composed — Permissions `AdminLoader` bridge.
 *
 * Registers the `system/permissions` pane with the `AdminPageRegistry`.
 * Permissions is a dual-mode pane: the bridge reads `useAdminMode()` and
 * renders the simplified or advanced view. Permissions is a grant-grid,
 * not a clean CRUD list — the views keep their bespoke tier-grid editor
 * Modal (+ the advanced per-resource override panel), but the user list
 * itself is the generic `AdminCrudList` view-module shape, so the slot is
 * declared as `AdminCrudList` and the pane dispatches through the
 * registry like the rest of the batch. `PermissionsViewModel` is unchanged.
 *
 * Self-registers on import; `PermissionsAdminUILoader` side-imports this
 * file and points BOTH modes at `AdminPageDispatch` — the bridge handles
 * the mode split internally.
 */
import React from 'react';
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import {useAdminMode} from '@admin/lib/adminMode';
import PermissionsSimplifiedView from './PermissionsSimplifiedView';
import PermissionsAdvancedView from './PermissionsAdvancedView';

const PermissionsBridge: React.FC = () => {
    const {mode} = useAdminMode();
    return mode === 'simplified'
        ? React.createElement(PermissionsSimplifiedView)
        : React.createElement(PermissionsAdvancedView);
};

export class PermissionsAdminLoader extends AdminLoader {
    readonly paneId = 'system/permissions';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = PermissionsBridge;
}

adminPageRegistry.register(new PermissionsAdminLoader());
