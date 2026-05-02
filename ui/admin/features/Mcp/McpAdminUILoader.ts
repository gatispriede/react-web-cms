import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import McpTokensPanel from './McpTokensPanel';

export class McpAdminUILoader extends AdminUILoader {
    readonly id = 'mcp';
    readonly displayName = 'MCP tokens';

    readonly adminPane: AdminPaneDescriptor = {
        id: 'system/mcp',
        title: 'MCP',
        route: '/admin/system/mcp',
        modes: {advanced: McpTokensPanel},
        advancedOnly: true,
    };
}
