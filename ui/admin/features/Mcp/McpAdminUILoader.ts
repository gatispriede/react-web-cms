/**
 * MCP tokens admin pane. Mounted at `/admin/system/mcp` under the
 * System area. Admin-only (`advancedOnly: true`).
 *
 * admin-module-composed: the pane is now module-composed —
 * `modes.advanced` dispatches through the `AdminPageRegistry` instead
 * of rendering the hand-coded pane directly. `./McpAdminLoader` is
 * side-imported so the `system/mcp` bridge registers at load.
 */
import React from 'react';
import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import {AdminPageDispatch} from '@admin/lib/adminPages/AdminPageDispatch';
import './McpAdminLoader';

const McpPaneDispatch: React.FC = () =>
    React.createElement(AdminPageDispatch, {paneId: 'system/mcp'});

export class McpAdminUILoader extends AdminUILoader {
    readonly id = 'mcp';
    readonly displayName = 'MCP tokens';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/mcp',
        title: 'MCP',
        route: '/admin/system/mcp',
        modes: {advanced: McpPaneDispatch},
        advancedOnly: true,
    };
}
