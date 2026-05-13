import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import AuthSettings from './AuthSettings';

/**
 * Auth admin pane — auth-split-client-admin (Phase 1.A).
 *
 * Surfaces under `/admin/system/auth`. Master switch +
 * per-provider sub-toggles. Read/write through the
 * `auth.config.*` MCP tools so the same surface is reachable from
 * an agent.
 */
export class AuthAdminUILoader extends AdminUILoader {
    readonly id = 'auth';
    readonly displayName = 'Customer login';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/auth',
        title: 'Customer login',
        route: '/admin/system/auth',
        modes: {advanced: AuthSettings},
    };
}
