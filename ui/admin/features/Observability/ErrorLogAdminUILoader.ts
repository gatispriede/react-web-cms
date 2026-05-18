/**
 * Error log admin pane — mounted at `/admin/system/errors`.
 *
 * admin-module-composed (Batch 1): `modes.advanced` dispatches through
 * the `AdminPageRegistry`; `./ErrorLogAdminLoader` is side-imported so
 * the `system/errors` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './ErrorLogAdminLoader';

const ErrorLogPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/errors'});

export class ErrorLogAdminUILoader extends AdminUILoader {
    readonly id = 'observability';
    readonly displayName = 'Error log';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/errors',
        title: 'Error log',
        route: '/admin/system/errors',
        modes: {advanced: ErrorLogPaneDispatch},
        advancedOnly: true,
    };
}
