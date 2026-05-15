/**
 * admin-module-composed — SEO overview `AdminLoader` bridge.
 *
 * Registers the `system/seo` pane with the `AdminPageRegistry`. The
 * bridge (`SeoOverview.tsx`) wires `SeoOverviewViewModel` to one
 * `AdminInfo` slot — the sitemap / OG-coverage stats + pre-flight
 * warnings table. Self-registers on import; `SeoOverviewAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import SeoOverviewPane from './SeoOverview';

export class SeoOverviewAdminLoader extends AdminLoader {
    readonly paneId = 'system/seo';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminInfo, locked: true},
    ];
    readonly Bridge = SeoOverviewPane;
}

adminPageRegistry.register(new SeoOverviewAdminLoader());
