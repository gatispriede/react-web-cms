import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import AbandonedCartPanel from './AbandonedCartPanel';

/**
 * Phase 1.B-d — abandoned-cart recovery admin pane loader (VM4).
 *
 * Lives under `/admin/client-config/abandoned-cart` alongside the
 * Commerce pane. Master switch + delay + discount code; the worker
 * itself fires from `CheckoutFeatureLoader` once the port lands.
 */
export class AbandonedCartAdminUILoader extends AdminUILoader {
    readonly id = 'abandoned-cart';
    readonly displayName = 'Abandoned cart recovery';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/abandoned-cart',
        title: 'Abandoned cart',
        route: '/admin/client-config/abandoned-cart',
        modes: {advanced: AbandonedCartPanel},
    };
}
