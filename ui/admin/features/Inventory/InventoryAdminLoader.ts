/**
 * admin-module-composed — Inventory `AdminLoader` bridge.
 *
 * Registers the `content/inventory` pane with the `AdminPageRegistry`.
 * The bridge component (`Inventory.tsx`) wires `InventoryViewModel` to a
 * single `AdminCrudList` view-module slot for the "Stock by product"
 * list; the status header, sync actions, run-log table, adapter-config
 * form and the bespoke errors Drawer + dead-letters Modal are kept
 * rendered alongside the module. Self-registers on import;
 * `InventoryAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Inventory from './Inventory';

export class InventoryAdminLoader extends AdminLoader {
    readonly paneId = 'content/inventory';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = Inventory;
}

adminPageRegistry.register(new InventoryAdminLoader());
