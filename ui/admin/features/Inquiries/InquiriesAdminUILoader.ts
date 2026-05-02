import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Inquiries from './Inquiries';

export class InquiriesAdminUILoader extends AdminUILoader {
    readonly id = 'inquiries';
    readonly displayName = 'Inquiries';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/inquiries',
        title: 'Inquiries',
        route: '/admin/system/inquiries',
        modes: {advanced: Inquiries},
    };
}
