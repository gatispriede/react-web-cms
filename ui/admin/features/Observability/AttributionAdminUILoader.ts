import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import AttributionPanel from './AttributionPanel';

/**
 * W6c — marketing attribution admin pane. Sibling of the W8d
 * Performance dashboard under the Observability bucket. Read-only;
 * referrer slug management (creating named ref labels) is reserved for
 * a follow-up once operators ask for it.
 */
export class AttributionAdminUILoader extends AdminUILoader {
    readonly id = 'observability-attribution';
    readonly displayName = 'Marketing attribution';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'marketing/attribution',
        title: 'Marketing attribution',
        route: '/admin/marketing/attribution',
        modes: {advanced: AttributionPanel},
        advancedOnly: true,
    };
}
