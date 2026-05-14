/**
 * Publishing admin pane. Mounted at `/admin/release/publishing` under
 * the Release area.
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./PublishingAdminLoader`
 * is side-imported so the `release/publishing` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './PublishingAdminLoader';

const PublishingPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'release/publishing'});

export class PublishingAdminUILoader extends AdminUILoader {
    readonly id = 'publishing';
    readonly displayName = 'Publishing';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/publishing',
        title: 'Publishing',
        route: '/admin/release/publishing',
        modes: {advanced: PublishingPaneDispatch},
    };
}
