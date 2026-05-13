import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import CommerceSettings from './CommerceSettings';

/**
 * AdminUILoader (VM4) for the Commerce settings pane — Phase 1.B
 * sub-jump B. Owns just the master `checkoutEnabled` switch for now;
 * the full payment-provider + shipping-method config lands in sub-jump
 * C with a separate `ShippingMethods` loader.
 */
export class CommerceAdminUILoader extends AdminUILoader {
    readonly id = 'commerce';
    readonly displayName = 'Commerce';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/commerce',
        title: 'Commerce',
        route: '/admin/client-config/commerce',
        modes: {advanced: CommerceSettings},
    };
}
