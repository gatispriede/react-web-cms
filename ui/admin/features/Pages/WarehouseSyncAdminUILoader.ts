/**
 * Phase 1.C — WarehouseSyncPanel AdminUILoader.
 *
 * Registers the warehouse-sync admin pane under
 * `/admin/content/warehouse-sync`. No simplified/advanced split for the
 * first cut — the surface is a single status + actions view.
 */
import {AdminUILoader, type AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import WarehouseSyncPanel from './WarehouseSyncPanel';

export class WarehouseSyncAdminUILoader extends AdminUILoader {
    readonly id = 'pages-warehouse-sync';
    readonly displayName = 'Warehouse sync';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/warehouse-sync',
        title: 'Warehouse sync',
        route: '/admin/content/warehouse-sync',
        modes: {
            advanced: WarehouseSyncPanel,
        },
        advancedOnly: true,
    };
}
