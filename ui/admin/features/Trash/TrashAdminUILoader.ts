import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './TrashAdminLoader';

/**
 * Trash admin pane — F2 / data-integrity.md. Lists soft-deleted cohorts
 * (`*.trash` collections) with a Restore action per group. Lives under
 * the `release` area next to Bundle/Audit so the cleanup tools cluster.
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./TrashAdminLoader` is
 * side-imported so the `release/trash` bridge registers at load.
 */
const TrashPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'release/trash'});

export class TrashAdminUILoader extends AdminUILoader {
    readonly id = 'trash';
    readonly displayName = 'Trash';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/trash',
        title: 'Trash',
        route: '/admin/release/trash',
        modes: {advanced: TrashPaneDispatch},
        advancedOnly: true,
    };
}
