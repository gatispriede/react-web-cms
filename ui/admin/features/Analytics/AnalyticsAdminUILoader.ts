/**
 * Analytics admin pane — mounted at `/admin/seo/analytics`.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry`; `./AnalyticsAdminLoader` is side-imported so the
 * `seo/analytics` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './AnalyticsAdminLoader';

const AnalyticsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'seo/analytics'});

export class AnalyticsAdminUILoader extends AdminUILoader {
    readonly id = 'analytics';
    readonly displayName = 'Analytics';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'seo/analytics',
        title: 'Analytics',
        route: '/admin/seo/analytics',
        // Analytics is naturally an "advanced" surface — admin-only,
        // dense data view. No simplified variant planned.
        modes: {
            advanced: AnalyticsPaneDispatch,
        },
        advancedOnly: true,
    };
}
