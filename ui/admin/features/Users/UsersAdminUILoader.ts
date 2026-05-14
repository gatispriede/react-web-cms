/**
 * Users admin pane. Mounted at `/admin/system/users` under the System area.
 *
 * admin-module-composed (Batch 2): the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./UsersAdminLoader` is
 * side-imported so the `system/users` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './UsersAdminLoader';

const UsersPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/users'});

export class UsersAdminUILoader extends AdminUILoader {
    readonly id = 'users';
    readonly displayName = 'Users';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/users',
        title: 'Users',
        route: '/admin/system/users',
        modes: {advanced: UsersPaneDispatch},
    };
}
