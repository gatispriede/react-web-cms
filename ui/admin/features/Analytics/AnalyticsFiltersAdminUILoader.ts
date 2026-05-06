import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import AnalyticsFiltersPanel from './AnalyticsFiltersPanel';

/**
 * Loader for the analytics-filters pane (`/admin/system/analytics-filters`).
 * Lives in the System cluster alongside MCP tokens / users / email,
 * since it's a configuration surface — not an analytics-reading surface.
 */
export class AnalyticsFiltersAdminUILoader extends AdminUILoader {
    readonly id = 'analytics-filters';
    readonly displayName = 'Analytics filters';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/analytics-filters',
        title: 'Analytics filters',
        route: '/admin/system/analytics-filters',
        modes: {advanced: AnalyticsFiltersPanel},
        advancedOnly: true,
    };
}
