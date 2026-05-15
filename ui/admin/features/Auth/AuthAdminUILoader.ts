import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './AuthAdminLoader';

/**
 * Auth admin pane — auth-split-client-admin (Phase 1.A).
 *
 * Surfaces under `/admin/system/auth`. Master switch +
 * per-provider sub-toggles. Read/write through the
 * `auth.config.*` MCP tools so the same surface is reachable from
 * an agent.
 *
 * admin-module-composed: `modes.advanced` dispatches through the
 * `AdminPageRegistry` instead of rendering the hand-coded pane directly.
 * `./AuthAdminLoader` is side-imported so the `system/auth` bridge
 * registers at load.
 */
const AuthPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/auth'});

export class AuthAdminUILoader extends AdminUILoader {
    readonly id = 'auth';
    readonly displayName = 'Customer login';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/auth',
        title: 'Customer login',
        route: '/admin/system/auth',
        modes: {advanced: AuthPaneDispatch},
    };
}
