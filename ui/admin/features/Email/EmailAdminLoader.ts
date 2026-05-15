/**
 * admin-module-composed — Email `AdminLoader` bridge.
 *
 * Registers the `system/email` pane with the `AdminPageRegistry`. The
 * bridge component (`Email.tsx`) wires `EmailViewModel` to a single
 * `AdminForm` view-module slot. Self-registers on import;
 * `EmailAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Email from './Email';

export class EmailAdminLoader extends AdminLoader {
    readonly paneId = 'system/email';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = Email;
}

adminPageRegistry.register(new EmailAdminLoader());
