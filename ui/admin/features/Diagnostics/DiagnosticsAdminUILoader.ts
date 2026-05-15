/**
 * F5 — Diagnostics admin pane. Mounted at `/admin/system/info` under
 * the System area. Admin-only (the area item carries `adminOnly: true`).
 *
 * admin-module-composed (Batch 1): the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./DiagnosticsAdminLoader`
 * is side-imported so the `system/info` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './DiagnosticsAdminLoader';

const DiagnosticsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/info'});

export class DiagnosticsAdminUILoader extends AdminUILoader {
    readonly id = 'diagnostics';
    readonly displayName = 'Diagnostics';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/info',
        title: 'Diagnostics',
        route: '/admin/system/info',
        modes: {advanced: DiagnosticsPaneDispatch},
        advancedOnly: true,
    };
}
