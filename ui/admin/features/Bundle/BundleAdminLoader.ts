/**
 * admin-module-composed — Bundle `AdminLoader` bridge.
 *
 * Registers the `release/bundle` pane with the `AdminPageRegistry`. The
 * bridge component (`Bundle.tsx`) wires `BundleViewModel` to a single
 * `AdminActionPanel` view-module slot. Self-registers on import;
 * `BundleAdminUILoader` side-imports this file.
 *
 * `BundleSettings` still takes a legacy `t` prop, so the bridge is a
 * zero-prop host that pulls `t` from `useTranslation` — same wrapper the
 * UI loader used before the migration.
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import BundleSettings from './Bundle';

const BundleBridge: React.FC = () => {
    const {t} = useTranslation();
    return React.createElement(BundleSettings, {t: t as any});
};

export class BundleAdminLoader extends AdminLoader {
    readonly paneId = 'release/bundle';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminActionPanel, locked: true},
    ];
    readonly Bridge = BundleBridge;
}

adminPageRegistry.register(new BundleAdminLoader());
