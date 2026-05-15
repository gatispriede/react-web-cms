/**
 * W8d performance dashboard — sibling of the existing Observability /
 * error-log pane. Surfaces RUM Core Web Vitals samples for the admin.
 * Read-only; budget enforcement happens in CI via `lighthouserc.cjs` +
 * `.size-limit.cjs`, not from this UI.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry`; `./PerfBeaconsAdminLoader` is side-imported so
 * the `system/performance` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './PerfBeaconsAdminLoader';

const PerfBeaconsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/performance'});

export class PerfBeaconsAdminUILoader extends AdminUILoader {
    readonly id = 'observability-perf';
    readonly displayName = 'Performance (RUM)';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/performance',
        title: 'Performance (RUM)',
        route: '/admin/system/performance',
        modes: {advanced: PerfBeaconsPaneDispatch},
        advancedOnly: true,
    };
}
