import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './BundleAdminLoader';

/**
 * admin-module-composed: the Bundle pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./BundleAdminLoader` is
 * side-imported so the `release/bundle` bridge registers at load.
 */
const BundlePaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'release/bundle'});

export class BundleAdminUILoader extends AdminUILoader {
    readonly id = 'bundle';
    readonly displayName = 'Bundle';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/bundle',
        title: 'Bundle',
        route: '/admin/release/bundle',
        modes: {advanced: BundlePaneDispatch},
    };
}
