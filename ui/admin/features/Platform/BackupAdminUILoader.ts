/**
 * W8e — Backup admin pane loader. Routed at `/admin/system/backups`.
 * Always rendered; service gating is reflected as a yellow banner inside
 * the pane.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./BackupAdminLoader` is side-imported so the `system/backups` bridge
 * registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './BackupAdminLoader';

const BackupPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/backups'});

export class BackupAdminUILoader extends AdminUILoader {
    readonly id = 'backup';
    readonly displayName = 'Backup';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/backups',
        title: 'Backup + DR',
        route: '/admin/system/backups',
        modes: {advanced: BackupPaneDispatch},
        advancedOnly: true,
    };
}
