/**
 * Phase 1.B-d — abandoned-cart recovery admin pane loader (VM4).
 *
 * Lives under `/admin/client-config/abandoned-cart` alongside the
 * Commerce pane. Master switch + delay + discount code; the worker
 * itself fires from `CheckoutFeatureLoader` once the port lands.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./AbandonedCartAdminLoader` is side-imported so the
 * `client-config/abandoned-cart` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './AbandonedCartAdminLoader';

const AbandonedCartPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'client-config/abandoned-cart'});

export class AbandonedCartAdminUILoader extends AdminUILoader {
    readonly id = 'abandoned-cart';
    readonly displayName = 'Abandoned cart recovery';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/abandoned-cart',
        title: 'Abandoned cart',
        route: '/admin/client-config/abandoned-cart',
        modes: {advanced: AbandonedCartPaneDispatch},
    };
}
