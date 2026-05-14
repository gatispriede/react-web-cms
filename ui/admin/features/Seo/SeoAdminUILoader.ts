import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './SeoAdminLoader';

/**
 * SEO defaults pane (admin → SEO). Site-wide SEO fallback used when a
 * page has no per-page SEO set.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./SeoAdminLoader` is side-imported so the `seo` bridge registers at
 * load. The legacy `UserStatusBar` `case 'seo'` stays as a fallback —
 * the registry lookup in `renderPane()` takes precedence.
 */
const SeoPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'seo'});

export class SeoAdminUILoader extends AdminUILoader {
    readonly id = 'seo';
    readonly displayName = 'SEO';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'seo',
        title: 'SEO',
        route: '/admin/seo',
        modes: {advanced: SeoPaneDispatch},
    };
}
