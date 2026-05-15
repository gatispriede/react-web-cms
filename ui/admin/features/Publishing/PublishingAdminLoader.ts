/**
 * admin-module-composed — Publishing `AdminLoader` bridge.
 *
 * Registers the `release/publishing` pane with the `AdminPageRegistry`.
 * The bridge component (`Publishing.tsx`) wires `PublishingViewModel`
 * to a single `AdminCrudList` view-module slot. Self-registers on
 * import; `PublishingAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import AdminSettingsPublishing from './Publishing';

export class PublishingAdminLoader extends AdminLoader {
    readonly paneId = 'release/publishing';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = AdminSettingsPublishing;
}

adminPageRegistry.register(new PublishingAdminLoader());
