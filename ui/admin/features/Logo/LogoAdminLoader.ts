/**
 * admin-module-composed — Logo `AdminLoader` bridge.
 *
 * Registers the `client-config/logo` pane with the `AdminPageRegistry`.
 * The bridge component (`LogoSettings.tsx`) wires `LogoViewModel` to a
 * single `AdminForm` view-module slot. Self-registers on import;
 * `LogoAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import LogoSettings from './LogoSettings';

export class LogoAdminLoader extends AdminLoader {
    readonly paneId = 'client-config/logo';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = LogoSettings;
}

adminPageRegistry.register(new LogoAdminLoader());
