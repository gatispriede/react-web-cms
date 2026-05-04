import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import TrashPane from './Trash';

/**
 * Trash admin pane — F2 / data-integrity.md. Lists soft-deleted cohorts
 * (`*.trash` collections) with a Restore action per group. Lives under
 * the `release` area next to Bundle/Audit so the cleanup tools cluster.
 */
export class TrashAdminUILoader extends AdminUILoader {
    readonly id = 'trash';
    readonly displayName = 'Trash';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/trash',
        title: 'Trash',
        route: '/admin/release/trash',
        modes: {advanced: TrashPane},
        advancedOnly: true,
    };
}
