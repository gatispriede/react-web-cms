/**
 * admin-module-composed — Auth `AdminLoader` bridge.
 *
 * Registers the `system/auth` pane with the `AdminPageRegistry`. The
 * bridge component (`AuthSettings.tsx`) wires `AuthSettingsViewModel`
 * to a single `AdminForm` view-module slot. Self-registers on import;
 * `AuthAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AuthSettings from './AuthSettings';

export class AuthAdminLoader extends AdminLoader {
    readonly paneId = 'system/auth';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = AuthSettings;
}

adminPageRegistry.register(new AuthAdminLoader());
