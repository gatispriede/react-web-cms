import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import DiagnosticsPane from './Diagnostics';

/**
 * F5 — Diagnostics admin pane. Mounted at `/admin/system/info` under
 * the System area. Admin-only (the area item carries `adminOnly: true`).
 *
 * Pane id `system/info` matches the `AdminView` literal added in
 * UserStatusBar so the registry-backed dispatcher resolves the route.
 */
export class DiagnosticsAdminUILoader extends AdminUILoader {
    readonly id = 'diagnostics';
    readonly displayName = 'Diagnostics';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/info',
        title: 'Diagnostics',
        route: '/admin/system/info',
        modes: {advanced: DiagnosticsPane},
        advancedOnly: true,
    };
}
