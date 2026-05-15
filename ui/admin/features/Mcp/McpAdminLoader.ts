/**
 * admin-module-composed — MCP tokens `AdminLoader` bridge.
 *
 * Registers the `system/mcp` pane with the `AdminPageRegistry`. The
 * bridge component (`McpTokensPanel.tsx`) wires `McpTokensViewModel` to
 * a single `AdminCrudList` view-module slot. Self-registers on import;
 * `McpAdminUILoader` side-imports this file.
 */
import {AdminLoader, type AdminModuleSlot} from '@admin/lib/adminPages/AdminLoader';
import {adminPageRegistry} from '@admin/lib/adminPages/AdminPageRegistry';
import {EAdminModuleType} from '@enums/EAdminModuleType';
import McpTokensPanel from './McpTokensPanel';

export class McpAdminLoader extends AdminLoader {
    readonly paneId = 'system/mcp';
    readonly slots: readonly AdminModuleSlot[] = [
        {type: EAdminModuleType.AdminCrudList, locked: true},
    ];
    readonly Bridge = McpTokensPanel;
}

adminPageRegistry.register(new McpAdminLoader());
