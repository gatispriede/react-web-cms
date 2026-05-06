import type {UserRole} from '@interfaces/IUser';
import type {McpScope} from '@interfaces/IMcp';
import {ALL_MCP_SCOPES} from '@interfaces/IMcp';

/**
 * Map a CMS user role to the set of MCP scopes that role is allowed to
 * exercise via the session-cookie auth path on the HTTP transport.
 *
 * Per `docs/runbooks/mcp-http-deploy.md` — when an admin/editor/viewer is
 * already logged into `/admin/*` in the same browser, the MCP endpoint
 * trusts that session and derives capability from the role rather than a
 * separate token row. Bearer tokens still exist for headless clients (the
 * token's scopes are the cap there, not the issuer's role).
 *
 * Mapping:
 *   - admin   → every scope, including `admin:auth` (lockout reset) and
 *               `admin:bundle` (full site export/import).
 *   - editor  → `read:*` + `write:*` for content/i18n/themes/products/
 *               inventory/site, plus `read:audit`/`read:analytics`. NO
 *               `admin:*` — editors don't reset lockouts or import bundles.
 *   - viewer  → all `read:*` scopes only. Pure read-only.
 *
 * Invariant: the returned array is a SUBSET of `ALL_MCP_SCOPES`. The
 * dispatcher gate inside McpServer.dispatch is unchanged — it just
 * compares the called tool's required scopes against this list.
 */
export function scopesForRole(role: UserRole): McpScope[] {
    if (role === 'admin') return [...ALL_MCP_SCOPES];
    if (role === 'editor') {
        return ALL_MCP_SCOPES.filter(s => !s.startsWith('admin:'));
    }
    // viewer — read-only.
    return ALL_MCP_SCOPES.filter(s => s.startsWith('read:'));
}
