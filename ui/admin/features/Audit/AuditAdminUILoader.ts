/**
 * Audit log admin pane — mounted at `/admin/release/audit`.
 *
 * admin-module-composed (Batch 1): `modes.advanced` dispatches through
 * the `AdminPageRegistry`; `./AuditAdminLoader` is side-imported so the
 * `release/audit` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './AuditAdminLoader';

const AuditPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'release/audit'});

export class AuditAdminUILoader extends AdminUILoader {
    readonly id = 'audit';
    readonly displayName = 'Audit log';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/audit',
        title: 'Audit',
        route: '/admin/release/audit',
        modes: {advanced: AuditPaneDispatch},
        advancedOnly: true,
    };
}
