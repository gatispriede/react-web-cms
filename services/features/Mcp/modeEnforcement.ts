/**
 * MCP execution gate — refuses advanced-only tools when the calling
 * user is in `simplified` admin UI mode.
 *
 * Per `docs/features/platform/admin-ui-modes.md` (decision 3): the
 * simplified surface only exposes the cut-down per-feature views, and
 * the MCP layer must mirror that boundary so an AI client can't hop
 * around the simplified guard rails by typing the tool name directly.
 *
 * Resolution flow
 *   1. Look up the actor as a user record (`UserService.getUser({email})`).
 *   2. If the actor doesn't resolve to a real user — e.g. the string is
 *      `mcp:<token-name>` from the MCP token transport — default-allow.
 *      Token actors aren't UI users; they have no mode of their own and
 *      the scope check on the dispatcher already guards them.
 *   3. If the user is `simplified` AND the toolId appears in
 *      `ADVANCED_ONLY_TOOLS`, throw `FeatureRestrictedError`.
 *
 * Wiring: each advanced-only tool resolver awaits this helper as the
 * first line of its handler, before reading args. Failures bubble up
 * through the dispatcher's existing error path (handler_error) and get
 * audited like any other tool failure.
 */

import {ADVANCED_ONLY_TOOLS} from './ADVANCED_TOOLS';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {log} from '@services/infra/logger';

/**
 * Thrown when a tool was invoked by a user whose admin UI mode is
 * `simplified` and the tool is on the advanced-only allowlist. Caught
 * by the McpServer dispatcher and serialised back to the client as a
 * structured error (code: `feature_restricted`).
 */
export class FeatureRestrictedError extends Error {
    public readonly code = 'feature_restricted' as const;
    constructor(message: string) {
        super(message);
        this.name = 'FeatureRestrictedError';
    }
}

const MCP_TOKEN_PREFIX = 'mcp:';

const isAdvancedOnly = (toolId: string): boolean =>
    ADVANCED_ONLY_TOOLS.has(toolId);

/**
 * Resolve `actorOrUserId` to an admin UI mode. Falls back to
 * `'advanced'` on any read error so a transient Mongo blip never hard-
 * blocks tool execution; the boundary is for UX, not a security gate.
 *
 * Accepts either a bare email or a userId-shaped string. The current
 * MCP transport stamps `actor = "mcp:<token-name>"` for token calls,
 * which short-circuits to `'advanced'` (no user => no mode).
 */
async function resolveMode(actorOrUserId: string): Promise<'simplified' | 'advanced'> {
    if (!actorOrUserId || actorOrUserId.startsWith(MCP_TOKEN_PREFIX)) {
        return 'advanced';
    }
    try {
        const conn = getMongoConnection();
        const userService = conn?.userService;
        if (!userService) return 'advanced';
        const user = await userService.getUser({email: actorOrUserId});
        if (user?.adminUiMode === 'simplified') return 'simplified';
        return 'advanced';
    } catch (err) {
        log.error({scope: 'mcp.modeEnforcement', err, actor: actorOrUserId},
            'mode lookup failed; defaulting to advanced');
        return 'advanced';
    }
}

/**
 * Throw `FeatureRestrictedError` when the calling user sits in
 * `simplified` mode and the requested tool is advanced-only.
 *
 * Safe to call at the top of every advanced-only resolver — the
 * allowlist check is in-memory and the user lookup is a single
 * findOne. No-ops for non-advanced tools so a copy-paste mistake
 * (calling it from a tool not on the list) never blocks legitimate
 * traffic.
 */
export async function enforceModeForTool(
    actorOrUserId: string,
    toolId: string,
): Promise<void> {
    if (!isAdvancedOnly(toolId)) return;
    const mode = await resolveMode(actorOrUserId);
    if (mode === 'simplified') {
        throw new FeatureRestrictedError(
            `Tool "${toolId}" is restricted to the advanced admin UI mode.`,
        );
    }
}
