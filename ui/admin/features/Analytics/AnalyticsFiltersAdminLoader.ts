/**
 * admin-module-composed — Analytics filters `AdminLoader` bridge.
 *
 * Registers the `system/analytics-filters` pane with the
 * `AdminPageRegistry`. The bridge (`AnalyticsFiltersPanel.tsx`) wires
 * `AnalyticsFiltersViewModel` to one `AdminInfo` slot — the editable IP
 * allowlist table. Self-registers on import;
 * `AnalyticsFiltersAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AnalyticsFiltersPanel from './AnalyticsFiltersPanel';

export class AnalyticsFiltersAdminLoader extends AdminLoader {
    readonly paneId = 'system/analytics-filters';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = AnalyticsFiltersPanel;
}

adminPageRegistry.register(new AnalyticsFiltersAdminLoader());
