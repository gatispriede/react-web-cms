/**
 * admin-module-composed — Email Templates `AdminLoader` bridge.
 *
 * Registers the `system/email-templates` pane with the
 * `AdminPageRegistry`. The pane is a master-detail surface (template
 * list + a sandboxed `<iframe>` HTML preview + send-test controls), not
 * a clean CRUD list — it doesn't reduce to `AdminCrudListModule`, so the
 * bridge (`Templates.tsx`) keeps its bespoke JSX. The slot is declared
 * as `AdminCrudList` (the closest shape: the list is the primary
 * surface). `TemplatesViewModel` is unchanged. Self-registers on
 * import; `EmailTemplatesAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Templates from './Templates';

export class EmailTemplatesAdminLoader extends AdminLoader {
    readonly paneId = 'system/email-templates';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = Templates;
}

adminPageRegistry.register(new EmailTemplatesAdminLoader());
