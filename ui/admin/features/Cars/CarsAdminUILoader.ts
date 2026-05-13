import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import CarsPanel from './CarsPanel';

export class CarsAdminUILoader extends AdminUILoader {
    readonly id = 'cars';
    readonly displayName = 'Cars';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/cars',
        title: 'Cars',
        route: '/admin/content/cars',
        modes: {advanced: CarsPanel},
    };
}
