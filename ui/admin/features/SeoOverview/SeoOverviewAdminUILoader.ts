import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';

/**
 * SEO overview admin pane — W8h SEO polish.
 *
 * Lives under `/admin/system/seo`. Single-mode (advanced) — surfaces
 * aggregated SEO health for the operator: sitemap counts, redirect
 * count, OG coverage, pre-flight warnings.
 */
const SeoOverview = React.lazy(() => import('./SeoOverview'));

export class SeoOverviewAdminUILoader extends AdminUILoader {
    readonly id = 'seo-overview';
    readonly displayName = 'SEO overview';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/seo',
        title: 'SEO overview',
        route: '/admin/system/seo',
        modes: {
            advanced: SeoOverview,
        },
    };
}
