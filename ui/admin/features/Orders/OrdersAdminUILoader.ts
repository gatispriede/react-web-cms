import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Orders from './Orders';

export class OrdersAdminUILoader extends AdminUILoader {
    readonly id = 'orders';
    readonly displayName = 'Orders';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/orders',
        title: 'Orders',
        route: '/admin/content/orders',
        modes: {advanced: Orders},
    };
}
