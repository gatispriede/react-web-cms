import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './RedirectsAdminLoader';

/**
 * Redirects admin pane — W8h SEO program § redirect map.
 *
 * Single mode (no simplified/advanced split — the surface is already
 * a four-field CRUD). Lives under `/admin/system/redirects`.
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./RedirectsAdminLoader`
 * is side-imported so the `system/redirects` bridge registers at load.
 */
const RedirectsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/redirects'});

export class RedirectsAdminUILoader extends AdminUILoader {
    readonly id = 'redirects';
    readonly displayName = 'Redirects';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/redirects',
        title: 'Redirects',
        route: '/admin/system/redirects',
        modes: {
            advanced: RedirectsPaneDispatch,
        },
    };
}
