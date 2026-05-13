import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import ReleasesSimplified from './ReleasesSimplified';
import ReleasesAdvanced from './ReleasesAdvanced';

/**
 * Content Releases admin pane — admin-content-releases.md. Lives under
 * `release/releases` alongside Bundle + Trash. Simplified covers the
 * happy-path editorial flow (list / create / attach / publish);
 * Advanced adds rollback + perspective preview metadata.
 */
export class ReleasesAdminUILoader extends AdminUILoader {
    readonly id = 'releases';
    readonly displayName = 'Releases';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'release/releases',
        title: 'Releases',
        route: '/admin/release/releases',
        modes: {
            simplified: ReleasesSimplified,
            advanced: ReleasesAdvanced,
        },
    };
}
