import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import LogoSettings from './LogoSettings';

export class LogoAdminUILoader extends AdminUILoader {
    readonly id = 'logo';
    readonly displayName = 'Logo';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'client-config/logo',
        title: 'Logo',
        route: '/admin/client-config/logo',
        modes: {advanced: LogoSettings},
    };
}
