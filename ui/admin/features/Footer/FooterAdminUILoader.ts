import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Footer from './Footer';

export class FooterAdminUILoader extends AdminUILoader {
    readonly id = 'footer';
    readonly displayName = 'Footer';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/footer',
        title: 'Footer',
        route: '/admin/content/footer',
        modes: {
            advanced: Footer,
        },
    };
}
