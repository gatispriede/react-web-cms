import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import Publishing from './Publishing';

export class PublishingAdminUILoader extends AdminUILoader {
    readonly id = 'publishing';
    readonly displayName = 'Publishing';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/publishing',
        title: 'Publishing',
        route: '/admin/release/publishing',
        modes: {advanced: Publishing},
    };
}
