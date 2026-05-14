/**
 * admin-module-composed (Batch 1) — Diagnostics `AdminLoader` bridge.
 *
 * Registers the `system/info` pane with the `AdminPageRegistry`. The
 * bridge component (`Diagnostics.tsx`) wires `DiagnosticsViewModel` to
 * a single `AdminInfo` view-module slot. Self-registers on import;
 * `DiagnosticsAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import DiagnosticsPane from './Diagnostics';

export class DiagnosticsAdminLoader extends AdminLoader {
    readonly paneId = 'system/info';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = DiagnosticsPane;
}

adminPageRegistry.register(new DiagnosticsAdminLoader());
