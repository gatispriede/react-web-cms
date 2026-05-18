/**
 * admin-module-composed — Abandoned-cart `AdminLoader` bridge.
 *
 * Registers the `client-config/abandoned-cart` pane with the
 * `AdminPageRegistry`. The bridge component (`AbandonedCartPanel.tsx`)
 * wires `AbandonedCartViewModel` to a single `AdminForm` view-module
 * slot. Self-registers on import; `AbandonedCartAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AbandonedCartPanel from './AbandonedCartPanel';

export class AbandonedCartAdminLoader extends AdminLoader {
    readonly paneId = 'client-config/abandoned-cart';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = AbandonedCartPanel;
}

adminPageRegistry.register(new AbandonedCartAdminLoader());
