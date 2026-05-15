/**
 * admin-module-composed — Cars `AdminLoader` bridge.
 *
 * Registers the `content/cars` pane with the `AdminPageRegistry`. Cars
 * is a tabbed two-table pane (Listings + Reservations, each its own
 * AntD table with bespoke action columns and Popconfirms) plus an
 * import-source control — it doesn't reduce to a single
 * `AdminCrudListModule`, so the bridge (`CarsPanel.tsx`) keeps its
 * bespoke JSX. The slot is declared as `AdminCrudList` (the closest
 * shape: the pane is list-driven). `CarsViewModel` is unchanged.
 * Self-registers on import; `CarsAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import CarsPanel from './CarsPanel';

export class CarsAdminLoader extends AdminLoader {
    readonly paneId = 'content/cars';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = CarsPanel;
}

adminPageRegistry.register(new CarsAdminLoader());
