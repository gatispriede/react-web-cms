/**
 * admin-module-composed — Commerce `AdminLoader` bridge.
 *
 * Registers the `client-config/commerce` pane with the
 * `AdminPageRegistry`. The bridge component (`CommerceSettings.tsx`)
 * wires `CommerceViewModel` to a single `AdminForm` view-module slot.
 * Self-registers on import; `CommerceAdminUILoader` side-imports this
 * file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import CommerceSettings from './CommerceSettings';

export class CommerceAdminLoader extends AdminLoader {
    readonly paneId = 'client-config/commerce';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = CommerceSettings;
}

adminPageRegistry.register(new CommerceAdminLoader());
