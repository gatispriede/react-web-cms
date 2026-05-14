/**
 * W6c — marketing attribution admin pane. Sibling of the W8d
 * Performance dashboard under the Observability bucket. Read-only;
 * referrer slug management (creating named ref labels) is reserved for
 * a follow-up once operators ask for it.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry`; `./AttributionAdminLoader` is side-imported so
 * the `marketing/attribution` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './AttributionAdminLoader';

const AttributionPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'marketing/attribution'});

export class AttributionAdminUILoader extends AdminUILoader {
    readonly id = 'observability-attribution';
    readonly displayName = 'Marketing attribution';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'marketing/attribution',
        title: 'Marketing attribution',
        route: '/admin/marketing/attribution',
        modes: {advanced: AttributionPaneDispatch},
        advancedOnly: true,
    };
}
