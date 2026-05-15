/**
 * Inquiries admin pane. Mounted at `/admin/system/inquiries` under the
 * System area.
 *
 * admin-module-composed (Batch 2): the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./InquiriesAdminLoader`
 * is side-imported so the `system/inquiries` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './InquiriesAdminLoader';

const InquiriesPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/inquiries'});

export class InquiriesAdminUILoader extends AdminUILoader {
    readonly id = 'inquiries';
    readonly displayName = 'Inquiries';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/inquiries',
        title: 'Inquiries',
        route: '/admin/system/inquiries',
        modes: {advanced: InquiriesPaneDispatch},
    };
}
