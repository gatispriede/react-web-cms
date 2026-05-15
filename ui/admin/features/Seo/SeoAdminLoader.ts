/**
 * admin-module-composed — SEO `AdminLoader` bridge.
 *
 * Registers the `seo` pane with the `AdminPageRegistry`. The bridge
 * component (`SEO.tsx`) wires `SEOViewModel` to a single `AdminForm`
 * view-module slot. Self-registers on import; `SeoAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AdminSettingsSEO from './SEO';

export class SeoAdminLoader extends AdminLoader {
    readonly paneId = 'seo';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminForm, locked: true},
    ];
    readonly Bridge = AdminSettingsSEO;
}

adminPageRegistry.register(new SeoAdminLoader());
