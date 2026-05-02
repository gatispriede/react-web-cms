import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import AuditTab from './AuditTab';

export class AuditAdminUILoader extends AdminUILoader {
    readonly id = 'audit';
    readonly displayName = 'Audit log';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/audit',
        title: 'Audit',
        route: '/admin/release/audit',
        modes: {advanced: AuditTab},
        advancedOnly: true,
    };
}
