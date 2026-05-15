/**
 * admin-module-composed — Marketing attribution `AdminLoader` bridge.
 *
 * Registers the `marketing/attribution` pane with the
 * `AdminPageRegistry`. The bridge (`AttributionPanel.tsx`) wires
 * `AttributionViewModel` to one `AdminInfo` slot — the total-hits stats
 * + aggregated attribution table. Self-registers on import;
 * `AttributionAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AttributionPanel from './AttributionPanel';

export class AttributionAdminLoader extends AdminLoader {
    readonly paneId = 'marketing/attribution';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = AttributionPanel;
}

adminPageRegistry.register(new AttributionAdminLoader());
