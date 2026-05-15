/**
 * admin-module-composed — Compliance `AdminLoader` bridge.
 *
 * Registers the `system/compliance` pane with the `AdminPageRegistry`.
 * The bridge (`CompliancePanel.tsx`) wires `CompliancePanelViewModel`
 * to one `AdminInfo` slot — the retention stats + pending-deletion
 * requests table. Self-registers on import; `ComplianceAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import CompliancePanel from './CompliancePanel';

export class ComplianceAdminLoader extends AdminLoader {
    readonly paneId = 'system/compliance';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = CompliancePanel;
}

adminPageRegistry.register(new ComplianceAdminLoader());
