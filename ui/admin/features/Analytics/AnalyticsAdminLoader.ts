/**
 * admin-module-composed — Analytics `AdminLoader` bridge.
 *
 * Registers the `seo/analytics` pane with the `AdminPageRegistry`. The
 * bridge (`AnalyticsPanel.tsx`) wires `AnalyticsPanelViewModel` to one
 * `AdminInfo` slot — KPI tiles, the recharts series, and the breakdown
 * tables ride in bespoke `node` blocks. Self-registers on import;
 * `AnalyticsAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AnalyticsPanel from './AnalyticsPanel';

export class AnalyticsAdminLoader extends AdminLoader {
    readonly paneId = 'seo/analytics';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = AnalyticsPanel;
}

adminPageRegistry.register(new AnalyticsAdminLoader());
