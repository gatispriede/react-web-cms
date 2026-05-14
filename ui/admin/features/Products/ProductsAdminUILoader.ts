/**
 * Products admin pane. Mounted at `/admin/content/products` under the
 * Content area.
 *
 * admin-module-composed (Batch 2): the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./ProductsAdminLoader` is
 * side-imported so the `content/products` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './ProductsAdminLoader';

const ProductsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'content/products'});

export class ProductsAdminUILoader extends AdminUILoader {
    readonly id = 'products';
    readonly displayName = 'Products';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/products',
        title: 'Products',
        route: '/admin/content/products',
        modes: {advanced: ProductsPaneDispatch},
    };
}
