/**
 * admin-module-composed (Batch 2) — Orders `AdminLoader` bridge.
 *
 * Registers the `content/orders` pane with the `AdminPageRegistry`. The
 * bridge component (`Orders.tsx`) wires `OrdersViewModel` to a single
 * `AdminCrudList` view-module slot, keeping the bespoke detail Drawer
 * rendered alongside. Self-registers on import; `OrdersAdminUILoader`
 * side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import Orders from './Orders';

export class OrdersAdminLoader extends AdminLoader {
    readonly paneId = 'content/orders';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = Orders;
}

adminPageRegistry.register(new OrdersAdminLoader());
