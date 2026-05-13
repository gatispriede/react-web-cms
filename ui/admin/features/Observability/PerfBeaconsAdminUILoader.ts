import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import PerfBeaconsPanel from './PerfBeaconsPanel';

/**
 * W8d performance dashboard — sibling of the existing Observability /
 * error-log pane. Surfaces RUM Core Web Vitals samples for the admin.
 * Read-only; budget enforcement happens in CI via `lighthouserc.cjs` +
 * `.size-limit.cjs`, not from this UI.
 */
export class PerfBeaconsAdminUILoader extends AdminUILoader {
    readonly id = 'observability-perf';
    readonly displayName = 'Performance (RUM)';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/performance',
        title: 'Performance (RUM)',
        route: '/admin/system/performance',
        modes: {advanced: PerfBeaconsPanel},
        advancedOnly: true,
    };
}
