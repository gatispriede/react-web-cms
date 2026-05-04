import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import AnalyticsPanel from './AnalyticsPanel';

export class AnalyticsAdminUILoader extends AdminUILoader {
    readonly id = 'analytics';
    readonly displayName = 'Analytics';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'seo/analytics',
        title: 'Analytics',
        route: '/admin/seo/analytics',
        // Analytics is naturally an "advanced" surface — admin-only,
        // dense data view. No simplified variant planned.
        modes: {
            advanced: AnalyticsPanel,
        },
        advancedOnly: true,
    };
}
