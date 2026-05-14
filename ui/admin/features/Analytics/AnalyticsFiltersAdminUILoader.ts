/**
 * Loader for the analytics-filters pane (`/admin/system/analytics-filters`).
 * Lives in the System cluster alongside MCP tokens / users / email,
 * since it's a configuration surface — not an analytics-reading surface.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry`; `./AnalyticsFiltersAdminLoader` is side-imported
 * so the `system/analytics-filters` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './AnalyticsFiltersAdminLoader';

const AnalyticsFiltersPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/analytics-filters'});

export class AnalyticsFiltersAdminUILoader extends AdminUILoader {
    readonly id = 'analytics-filters';
    readonly displayName = 'Analytics filters';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/analytics-filters',
        title: 'Analytics filters',
        route: '/admin/system/analytics-filters',
        modes: {advanced: AnalyticsFiltersPaneDispatch},
        advancedOnly: true,
    };
}
