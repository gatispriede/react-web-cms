import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Inventory from './Inventory';

export class InventoryAdminUILoader extends AdminUILoader {
    readonly id = 'inventory';
    readonly displayName = 'Inventory';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/inventory',
        title: 'Inventory',
        route: '/admin/content/inventory',
        modes: {advanced: Inventory},
        advancedOnly: true,
    };
}
