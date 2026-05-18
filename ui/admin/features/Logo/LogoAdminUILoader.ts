import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './LogoAdminLoader';

/**
 * Logo settings pane (admin → Client config → Logo).
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./LogoAdminLoader` is side-imported so the `client-config/logo`
 * bridge registers at load.
 */
const LogoPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'client-config/logo'});

export class LogoAdminUILoader extends AdminUILoader {
    readonly id = 'logo';
    readonly displayName = 'Logo';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/logo',
        title: 'Logo',
        route: '/admin/client-config/logo',
        modes: {advanced: LogoPaneDispatch},
    };
}
