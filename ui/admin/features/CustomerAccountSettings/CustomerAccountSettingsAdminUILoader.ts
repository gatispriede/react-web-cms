/**
 * Admin pane registration for the Phase 1.E customer-account-settings
 * surface. Routed under `/admin/system/account-settings` to sit next
 * to the auth pane.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./CustomerAccountSettingsAdminLoader` is side-imported so the
 * `system/account-settings` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './CustomerAccountSettingsAdminLoader';

const CustomerAccountSettingsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/account-settings'});

export class CustomerAccountSettingsAdminUILoader extends AdminUILoader {
    readonly id = 'customer-account-settings';
    readonly displayName = 'Customer account settings';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/account-settings',
        title: 'Customer account settings',
        route: '/admin/system/account-settings',
        modes: {advanced: CustomerAccountSettingsPaneDispatch},
    };
}
