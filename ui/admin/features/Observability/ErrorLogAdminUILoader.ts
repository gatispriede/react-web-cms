import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import ErrorLogPanel from './ErrorLogPanel';

export class ErrorLogAdminUILoader extends AdminUILoader {
    readonly id = 'observability';
    readonly displayName = 'Error log';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/errors',
        title: 'Error log',
        route: '/admin/release/errors',
        modes: {advanced: ErrorLogPanel},
        advancedOnly: true,
    };
}
