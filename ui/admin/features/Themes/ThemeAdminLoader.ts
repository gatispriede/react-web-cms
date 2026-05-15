/**
 * admin-module-composed — Themes `AdminLoader` bridge.
 *
 * Registers the `client-config/themes` pane with the `AdminPageRegistry`.
 * Themes is a dual-mode pane: the bridge reads `useAdminMode()` and
 * renders the simplified or advanced view. Themes is preview-coupled —
 * the gallery cards wrap `ThemePreviewFrame`, which is not a clean CRUD
 * table, so the views keep their bespoke gallery JSX (+ the advanced
 * modal token editor / FontPicker / ConflictDialog) rather than forcing
 * the `AdminCrudList` table shape. The slot is still declared as
 * `AdminCrudList` (the nearest list-shaped capacity) so the pane
 * dispatches through the registry like the rest of the batch.
 * `ThemesViewModel` is unchanged.
 *
 * Self-registers on import; `ThemeAdminUILoader` side-imports this file
 * and points BOTH modes at `AdminPageDispatch`.
 */
import React from 'react';
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import {useAdminMode} from '@admin/lib/adminMode';
import ThemeSimplifiedView from './ThemeSimplifiedView';
import ThemeAdvancedView from './ThemeAdvancedView';

const ThemeBridge: React.FC = () => {
    const {mode} = useAdminMode();
    return mode === 'simplified'
        ? React.createElement(ThemeSimplifiedView)
        : React.createElement(ThemeAdvancedView);
};

export class ThemeAdminLoader extends AdminLoader {
    readonly paneId = 'client-config/themes';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = ThemeBridge;
}

adminPageRegistry.register(new ThemeAdminLoader());
