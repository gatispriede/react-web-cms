import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Users from './Users';

export class UsersAdminUILoader extends AdminUILoader {
    readonly id = 'users';
    readonly displayName = 'Users';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/users',
        title: 'Users',
        route: '/admin/system/users',
        modes: {advanced: Users},
    };
}
