/**
 * admin-module-composed — Site (currency settings) `AdminLoader` bridge.
 *
 * Registers the `system/currency` pane with the `AdminPageRegistry`.
 * The bridge component (`CurrencySettings.tsx`) wires
 * `CurrencySettingsViewModel` to a single `AdminForm` view-module slot.
 * Self-registers on import.
 *
 * NOTE: the Site feature has no `*AdminUILoader.ts` and the pane is not
 * yet mounted by the shell's `renderPane()` — wiring it into the
 * sidebar is out of scope for this conversion. This loader keeps the
 * pane module-composed and registry-resolvable for when it lands.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import CurrencySettings from './CurrencySettings';

export class SiteAdminLoader extends AdminLoader {
    readonly paneId = 'system/currency';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = CurrencySettings;
}

adminPageRegistry.register(new SiteAdminLoader());
