import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import ErrorLogPanel from './ErrorLogPanel';

export class ErrorLogAdminUILoader extends AdminUILoader {
    readonly id = 'observability';
    readonly displayName = 'Error log';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/errors',
        title: 'Error log',
        route: '/admin/system/errors',
        modes: {advanced: ErrorLogPanel},
        advancedOnly: true,
    };
}
