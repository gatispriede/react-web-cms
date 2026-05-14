/**
 * admin-module-composed — Customer account settings `AdminLoader` bridge.
 *
 * Registers the `system/account-settings` pane with the
 * `AdminPageRegistry`. The bridge component
 * (`CustomerAccountSettingsPanel.tsx`) wires
 * `CustomerAccountSettingsViewModel` to a single `AdminForm`
 * view-module slot. Self-registers on import;
 * `CustomerAccountSettingsAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import CustomerAccountSettingsPanel from './CustomerAccountSettingsPanel';

export class CustomerAccountSettingsAdminLoader extends AdminLoader {
    readonly paneId = 'system/account-settings';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = CustomerAccountSettingsPanel;
}

adminPageRegistry.register(new CustomerAccountSettingsAdminLoader());
