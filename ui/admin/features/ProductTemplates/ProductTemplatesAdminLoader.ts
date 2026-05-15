/**
 * admin-module-composed — Product Templates `AdminLoader` bridge.
 *
 * Registers the `content/product-templates` pane with the
 * `AdminPageRegistry`. The pane is a master-detail surface (template
 * list + a metadata + section editor), not a clean CRUD list — it
 * doesn't reduce to `AdminCrudListModule`, so the bridge
 * (`ProductTemplatesPanel.tsx`) keeps its bespoke JSX. The slot is
 * declared as `AdminCrudList` (the closest shape: the list is the
 * primary surface). It's a dual-mode pane, but both `simplified` and
 * `advanced` render the identical panel, so the bridge needs no
 * `useAdminMode()` split. `ProductTemplatesViewModel` is unchanged.
 * Self-registers on import; `ProductTemplatesAdminUILoader` side-imports
 * this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import ProductTemplatesPanel from './ProductTemplatesPanel';

export class ProductTemplatesAdminLoader extends AdminLoader {
    readonly paneId = 'content/product-templates';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = ProductTemplatesPanel;
}

adminPageRegistry.register(new ProductTemplatesAdminLoader());
