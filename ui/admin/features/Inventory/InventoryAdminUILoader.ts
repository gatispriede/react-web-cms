import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './InventoryAdminLoader';

/**
 * Inventory admin pane. Lives under `/admin/content/inventory`.
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./InventoryAdminLoader` is
 * side-imported so the `content/inventory` bridge registers at load.
 */
const InventoryPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'content/inventory'});

export class InventoryAdminUILoader extends AdminUILoader {
    readonly id = 'inventory';
    readonly displayName = 'Inventory';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/inventory',
        title: 'Inventory',
        route: '/admin/content/inventory',
        modes: {advanced: InventoryPaneDispatch},
        advancedOnly: true,
    };
}
