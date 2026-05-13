import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import CustomerAccountSettingsPanel from './CustomerAccountSettingsPanel';

/**
 * Admin pane registration for the Phase 1.E customer-account-settings
 * surface. Routed under `/admin/system/account-settings` to sit next
 * to the auth pane.
 */
export class CustomerAccountSettingsAdminUILoader extends AdminUILoader {
    readonly id = 'customer-account-settings';
    readonly displayName = 'Customer account settings';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/account-settings',
        title: 'Customer account settings',
        route: '/admin/system/account-settings',
        modes: {advanced: CustomerAccountSettingsPanel},
    };
}
