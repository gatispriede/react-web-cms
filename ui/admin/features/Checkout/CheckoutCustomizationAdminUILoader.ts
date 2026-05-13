/**
 * Phase 1.B-c — admin UI loader for the checkout customization pane.
 * Sibling to `CommerceAdminUILoader` (master checkoutEnabled toggle).
 * This loader owns the per-checkout config: flow shape, payment
 * providers, per-customer-type fields, shipping methods.
 */
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import CheckoutCustomizationPanel from './CheckoutCustomizationPanel';

export class CheckoutCustomizationAdminUILoader extends AdminUILoader {
    readonly id = 'checkout-customization';
    readonly displayName = 'Checkout';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/checkout',
        title: 'Checkout',
        route: '/admin/client-config/checkout',
        modes: {advanced: CheckoutCustomizationPanel},
    };
}
