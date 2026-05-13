import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import CompliancePanel from './CompliancePanel';

export class ComplianceAdminUILoader extends AdminUILoader {
    readonly id = 'compliance';
    readonly displayName = 'Compliance';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/compliance',
        title: 'Compliance',
        route: '/admin/system/compliance',
        modes: {advanced: CompliancePanel},
    };
}
