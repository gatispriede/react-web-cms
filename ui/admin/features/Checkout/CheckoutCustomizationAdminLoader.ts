/**
 * admin-module-composed — Checkout customization `AdminLoader` bridge.
 *
 * Registers the `client-config/checkout` pane with the
 * `AdminPageRegistry`. The bridge component
 * (`CheckoutCustomizationPanel.tsx`) wires
 * `CheckoutCustomizationViewModel` to a single `AdminForm` view-module
 * slot. Self-registers on import; `CheckoutCustomizationAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import CheckoutCustomizationPanel from './CheckoutCustomizationPanel';

export class CheckoutCustomizationAdminLoader extends AdminLoader {
    readonly paneId = 'client-config/checkout';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = CheckoutCustomizationPanel;
}

adminPageRegistry.register(new CheckoutCustomizationAdminLoader());
