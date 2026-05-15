/**
 * SEO overview admin pane — W8h SEO polish.
 *
 * Lives under `/admin/system/seo`. Single-mode (advanced) — surfaces
 * aggregated SEO health for the operator: sitemap counts, redirect
 * count, OG coverage, pre-flight warnings.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry`; `./SeoOverviewAdminLoader` is side-imported so
 * the `system/seo` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './SeoOverviewAdminLoader';

const SeoOverviewPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/seo'});

export class SeoOverviewAdminUILoader extends AdminUILoader {
    readonly id = 'seo-overview';
    readonly displayName = 'SEO overview';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/seo',
        title: 'SEO overview',
        route: '/admin/system/seo',
        modes: {
            advanced: SeoOverviewPaneDispatch,
        },
    };
}
