/**
 * admin-module-composed — Performance (RUM) `AdminLoader` bridge.
 *
 * Registers the `system/performance` pane with the `AdminPageRegistry`.
 * The bridge (`PerfBeaconsPanel.tsx`) wires `PerfBeaconsViewModel` to
 * one `AdminInfo` slot — the p50/p75/p95 summary cards + recent-samples
 * table. Self-registers on import; `PerfBeaconsAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import PerfBeaconsPanel from './PerfBeaconsPanel';

export class PerfBeaconsAdminLoader extends AdminLoader {
    readonly paneId = 'system/performance';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = PerfBeaconsPanel;
}

adminPageRegistry.register(new PerfBeaconsAdminLoader());
