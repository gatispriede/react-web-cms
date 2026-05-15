/**
 * admin-module-composed (Batch 2) — Products `AdminLoader` bridge.
 *
 * Registers the `content/products` pane with the `AdminPageRegistry`.
 * The bridge component (`Products.tsx`) wires `ProductsViewModel` to a
 * single `AdminCrudList` view-module slot, keeping the bespoke edit
 * Drawer + the `AdminConflict` module rendered alongside. Self-registers
 * on import; `ProductsAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Products from './Products';

export class ProductsAdminLoader extends AdminLoader {
    readonly paneId = 'content/products';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = Products;
}

adminPageRegistry.register(new ProductsAdminLoader());
