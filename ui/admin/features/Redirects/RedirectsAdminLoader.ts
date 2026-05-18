/**
 * admin-module-composed — Redirects `AdminLoader` bridge.
 *
 * Registers the `system/redirects` pane with the `AdminPageRegistry`.
 * The bridge component (`Redirects.tsx`) wires `RedirectsViewModel` to a
 * single `AdminCrudList` view-module slot, keeping the bespoke
 * create/edit Modal rendered alongside. Self-registers on import;
 * `RedirectsAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import RedirectsPane from './Redirects';

export class RedirectsAdminLoader extends AdminLoader {
    readonly paneId = 'system/redirects';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = RedirectsPane;
}

adminPageRegistry.register(new RedirectsAdminLoader());
