/**
 * Wave 8b — Admin compliance pane. Mounted at `/admin/system/compliance`.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry`; `./ComplianceAdminLoader` is side-imported so
 * the `system/compliance` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './ComplianceAdminLoader';

const CompliancePaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/compliance'});

export class ComplianceAdminUILoader extends AdminUILoader {
    readonly id = 'compliance';
    readonly displayName = 'Compliance';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/compliance',
        title: 'Compliance',
        route: '/admin/system/compliance',
        modes: {advanced: CompliancePaneDispatch},
    };
}
