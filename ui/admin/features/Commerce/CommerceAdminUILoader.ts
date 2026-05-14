import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './CommerceAdminLoader';

/**
 * AdminUILoader (VM4) for the Commerce settings pane — Phase 1.B
 * sub-jump B. Owns just the master `checkoutEnabled` switch for now;
 * the full payment-provider + shipping-method config lands in sub-jump
 * C with a separate `ShippingMethods` loader.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./CommerceAdminLoader` is side-imported so the `client-config/commerce`
 * bridge registers at load.
 */
const CommercePaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'client-config/commerce'});

export class CommerceAdminUILoader extends AdminUILoader {
    readonly id = 'commerce';
    readonly displayName = 'Commerce';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/commerce',
        title: 'Commerce',
        route: '/admin/client-config/commerce',
        modes: {advanced: CommercePaneDispatch},
    };
}
