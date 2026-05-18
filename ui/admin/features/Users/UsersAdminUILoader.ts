/**
 * Users admin pane. Mounted at `/admin/settings/access/users` under
 * the Settings area (re-pivoted from `/admin/people/users` — the
 * People bucket dissolved into Settings/access on 2026-05-16).
 *
 * admin-module-composed (Batch 2): the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./UsersAdminLoader` is
 * side-imported so the `settings/access/users` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './UsersAdminLoader';

const UsersPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'settings/access/users'});

export class UsersAdminUILoader extends AdminUILoader {
    readonly id = 'users';
    readonly displayName = 'Users';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'settings/access/users',
        title: 'Users',
        route: '/admin/settings/access/users',
        modes: {advanced: UsersPaneDispatch},
    };
}
