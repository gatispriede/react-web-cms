import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import BackupPanel from './BackupPanel';

/**
 * W8e — Backup admin pane loader. Routed at `/admin/system/backups`.
 * Always rendered; service gating is reflected as a yellow banner inside
 * the pane.
 */
export class BackupAdminUILoader extends AdminUILoader {
    readonly id = 'backup';
    readonly displayName = 'Backup';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/backups',
        title: 'Backup + DR',
        route: '/admin/system/backups',
        modes: {advanced: BackupPanel},
        advancedOnly: true,
    };
}
