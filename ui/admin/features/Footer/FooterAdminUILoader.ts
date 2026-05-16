import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './FooterAdminLoader';

/**
 * Footer admin pane. Lives under `/admin/site/footer`.
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./FooterAdminLoader` is
 * side-imported so the `site/footer` bridge registers at load.
 */
const FooterPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'site/footer'});

export class FooterAdminUILoader extends AdminUILoader {
    readonly id = 'footer';
    readonly displayName = 'Footer';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'site/footer',
        title: 'Footer',
        route: '/admin/site/footer',
        modes: {
            advanced: FooterPaneDispatch,
        },
    };
}
