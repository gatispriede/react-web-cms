/**
 * admin-module-composed — Backup `AdminLoader` bridge.
 *
 * Registers the `system/backups` pane with the `AdminPageRegistry`.
 * The bridge component (`BackupPanel.tsx`) wires `BackupPanelViewModel`
 * to a single `AdminInfo` view-module slot — the pane is a read-only
 * DR dashboard with imperative actions, not a single-doc form.
 * Self-registers on import; `BackupAdminUILoader` side-imports this
 * file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import BackupPanel from './BackupPanel';

export class BackupAdminLoader extends AdminLoader {
    readonly paneId = 'system/backups';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = BackupPanel;
}

adminPageRegistry.register(new BackupAdminLoader());
