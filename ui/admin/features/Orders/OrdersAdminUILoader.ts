/**
 * Orders admin pane. Mounted at `/admin/content/orders` under the
 * Content area.
 *
 * admin-module-composed (Batch 2): the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./OrdersAdminLoader` is
 * side-imported so the `content/orders` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './OrdersAdminLoader';

const OrdersPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'content/orders'});

export class OrdersAdminUILoader extends AdminUILoader {
    readonly id = 'orders';
    readonly displayName = 'Orders';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/orders',
        title: 'Orders',
        route: '/admin/content/orders',
        modes: {advanced: OrdersPaneDispatch},
    };
}
