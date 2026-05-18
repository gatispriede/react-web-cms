/**
 * admin-module-composed — Trash `AdminLoader` bridge.
 *
 * Registers the `release/trash` pane with the `AdminPageRegistry`. The
 * bridge component (`Trash.tsx`) wires `TrashViewModel` to a single
 * `AdminCrudList` view-module slot — the Restore action lives in the
 * bridge-built Actions column. Self-registers on import;
 * `TrashAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import TrashPane from './Trash';

export class TrashAdminLoader extends AdminLoader {
    readonly paneId = 'release/trash';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = TrashPane;
}

adminPageRegistry.register(new TrashAdminLoader());
