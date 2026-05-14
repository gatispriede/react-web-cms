/**
 * admin-module-composed (Batch 1) — Audit log `AdminLoader` bridge.
 *
 * Registers the `release/audit` pane with the `AdminPageRegistry`. The
 * bridge (`AuditTab.tsx`) wires `AuditViewModel` to one `AdminInfo`
 * table slot + a filter toolbar + a detail Drawer. Self-registers on
 * import; `AuditAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AuditTab from './AuditTab';

export class AuditAdminLoader extends AdminLoader {
    readonly paneId = 'release/audit';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = AuditTab;
}

adminPageRegistry.register(new AuditAdminLoader());
