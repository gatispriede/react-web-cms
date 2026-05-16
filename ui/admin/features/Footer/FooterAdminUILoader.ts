import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './FooterAdminLoader';

/**
 * Footer admin pane. Lives under `/admin/settings/chrome/footer`.
 *
 * admin-information-architecture re-pivot (2026-05-16, same day as the
 * first ship): the 6-bucket Site/Content/Commerce/People/Analytics/System
 * taxonomy collapses to 5 task-driven buckets. The Site bucket dissolves —
 * Footer is global site chrome (header + logo + footer co-located under
 * `/admin/settings/chrome/*`), so the pane moves under Settings → Chrome.
 *
 * admin-module-composed: the pane is module-composed — `modes.advanced`
 * dispatches through the `AdminPageRegistry` instead of rendering the
 * hand-coded pane directly. `./FooterAdminLoader` is side-imported so the
 * `settings/chrome/footer` bridge registers at load.
 */
const FooterPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'settings/chrome/footer'});

export class FooterAdminUILoader extends AdminUILoader {
    readonly id = 'footer';
    readonly displayName = 'Footer';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'settings/chrome/footer',
        title: 'Footer',
        route: '/admin/settings/chrome/footer',
        modes: {
            advanced: FooterPaneDispatch,
        },
    };
}
