/**
 * Phase 1.B-c — admin UI loader for the checkout customization pane.
 * Sibling to `CommerceAdminUILoader` (master checkoutEnabled toggle).
 * This loader owns the per-checkout config: flow shape, payment
 * providers, per-customer-type fields, shipping methods.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./CheckoutCustomizationAdminLoader` is side-imported so the
 * `client-config/checkout` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './CheckoutCustomizationAdminLoader';

const CheckoutCustomizationPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'client-config/checkout'});

export class CheckoutCustomizationAdminUILoader extends AdminUILoader {
    readonly id = 'checkout-customization';
    readonly displayName = 'Checkout';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/checkout',
        title: 'Checkout',
        route: '/admin/client-config/checkout',
        modes: {advanced: CheckoutCustomizationPaneDispatch},
    };
}
