/**
 * admin-module-composed (Batch 2) — Users `AdminLoader` bridge.
 *
 * Registers the `system/users` pane with the `AdminPageRegistry`. The
 * bridge component (`Users.tsx`) wires `UsersViewModel` to a single
 * `AdminCrudList` view-module slot, keeping the bespoke edit Modal
 * rendered alongside. Self-registers on import; `UsersAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Users from './Users';

export class UsersAdminLoader extends AdminLoader {
    readonly paneId = 'system/users';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = Users;
}

adminPageRegistry.register(new UsersAdminLoader());
