/**
 * admin-module-composed (Batch 1) — Error log `AdminLoader` bridge.
 *
 * Registers the `system/errors` pane with the `AdminPageRegistry`. The
 * bridge (`ErrorLogPanel.tsx`) wires `ErrorLogViewModel` to one
 * `AdminInfo` table slot + a filter toolbar. Self-registers on import;
 * `ErrorLogAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import ErrorLogPanel from './ErrorLogPanel';

export class ErrorLogAdminLoader extends AdminLoader {
    readonly paneId = 'system/errors';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = ErrorLogPanel;
}

adminPageRegistry.register(new ErrorLogAdminLoader());
