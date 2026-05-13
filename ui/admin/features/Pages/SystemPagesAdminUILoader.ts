/**
 * Phase 1.D — SystemPagesPanel AdminUILoader.
 *
 * Lists the framework-required pages registered with
 * `SystemPageRegistry`. Mounted at /admin/content/system-pages.
 */
import {AdminUILoader, type AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import SystemPagesPanel from './SystemPagesPanel';

export class SystemPagesAdminUILoader extends AdminUILoader {
    readonly id = 'pages-system-pages';
    readonly displayName = 'System pages';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'content/system-pages',
        title: 'System pages',
        route: '/admin/content/system-pages',
        modes: {
            advanced: SystemPagesPanel,
        },
        advancedOnly: true,
    };
}
