import {McpTool} from '../types';
import {PAGE_TOOLS} from './pages';
import {MODULE_TOOLS} from './modules';
import {TRANSLATION_TOOLS} from './translations';
import {THEME_TOOLS} from './themes';
import {PRODUCT_TOOLS} from './products';
import {INVENTORY_TOOLS} from './inventory';
import {SITE_TOOLS} from './site';
import {AUDIT_TOOLS} from './audit';

/**
 * Out of scope (defer):
 *   - inventory.syncAll  (reserved for v2 once we have a "are you sure?" confirmation flow)
 *   - bundle.export / bundle.import  (entire-site replace; needs a separate `admin:bundle` scope)
 *   - MCP Resources (`cms://...`)
 *   - MCP Prompts (`add-blog-post` / `localize-page` / `roll-out-theme`)
 *   - Orders / cart tool surface  (admin uses the admin UI for those for now)
 */
export const ALL_MCP_TOOLS: McpTool[] = [
    ...PAGE_TOOLS,
    ...MODULE_TOOLS,
    ...TRANSLATION_TOOLS,
    ...THEME_TOOLS,
    ...PRODUCT_TOOLS,
    ...INVENTORY_TOOLS,
    ...SITE_TOOLS,
    ...AUDIT_TOOLS,
];

export function buildToolRegistry(): Map<string, McpTool> {
    const map = new Map<string, McpTool>();
    for (const t of ALL_MCP_TOOLS) {
        if (map.has(t.name)) {
            throw new Error(`MCP tool registry: duplicate tool name ${t.name}`);
        }
        map.set(t.name, t);
    }
    return map;
}
