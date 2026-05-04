import {McpTool} from '../types';
import {log} from '@services/infra/logger';
import {PAGE_TOOLS} from './pages';
import {MODULE_TOOLS} from './modules';
import {TRANSLATION_TOOLS} from './translations';
import {THEME_TOOLS} from './themes';
import {PRODUCT_TOOLS} from './products';
import {INVENTORY_TOOLS} from './inventory';
import {SITE_TOOLS} from './site';
import {AUDIT_TOOLS} from './audit';
import {ANALYTICS_TOOLS} from './analytics';
import {POST_TOOLS} from './posts';
import {IMAGE_TOOLS} from './images';
import {BUNDLE_TOOLS} from './bundle';
import {INQUIRY_TOOLS} from './inquiries';

/**
 * Out of scope (defer):
 *   - inventory.syncAll  (reserved for v2 once we have a "are you sure?" confirmation flow)
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
    ...ANALYTICS_TOOLS,
    ...POST_TOOLS,
    ...IMAGE_TOOLS,
    ...BUNDLE_TOOLS,
    ...INQUIRY_TOOLS,
];

/**
 * Tool names whose suffix marks them as destructive. Phase-2 sweep will
 * tag these with `idempotent: true` explicitly; until then we soft-warn
 * at registration time so the gap is visible in startup logs without
 * breaking the existing 38 tools.
 */
const DESTRUCTIVE_SUFFIXES = ['.delete', '.remove', '.purge', '.destroy'];

function isDestructiveByName(name: string): boolean {
    return DESTRUCTIVE_SUFFIXES.some(s => name.endsWith(s));
}

export function buildToolRegistry(): Map<string, McpTool> {
    const map = new Map<string, McpTool>();
    for (const t of ALL_MCP_TOOLS) {
        if (map.has(t.name)) {
            throw new Error(`MCP tool registry: duplicate tool name ${t.name}`);
        }
        if (isDestructiveByName(t.name) && t.idempotent !== true) {
            // Phase-2 sweep target: every destructive tool should opt
            // into the idempotency wrapper. Warn (don't throw) so the
            // existing 38 tools keep registering until they're swept.
            log.warn(
                {scope: 'mcp.registry', tool: t.name},
                'destructive MCP tool registered without `idempotent: true`',
            );
        }
        map.set(t.name, t);
    }
    return map;
}
