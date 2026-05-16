/**
 * F5 — Diagnostics admin pane. Mounted at `/admin/system/diagnostics` under
 * the System area. Admin-only (the area item carries `adminOnly: true`).
 *
 * admin-module-composed (Batch 1): the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./DiagnosticsAdminLoader`
 * is side-imported so the `system/diagnostics` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './DiagnosticsAdminLoader';

const DiagnosticsPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/diagnostics'});

export class DiagnosticsAdminUILoader extends AdminUILoader {
    readonly id = 'diagnostics';
    readonly displayName = 'Diagnostics';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/diagnostics',
        title: 'Diagnostics',
        route: '/admin/system/diagnostics',
        modes: {advanced: DiagnosticsPaneDispatch},
        advancedOnly: true,
    };
}
