import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Layout from './Layout';

export class LayoutAdminUILoader extends AdminUILoader {
    readonly id = 'siteLayout';
    readonly displayName = 'Site layout';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/site-layout',
        title: 'Site layout',
        route: '/admin/client-config/site-layout',
        modes: {advanced: Layout},
    };
}
