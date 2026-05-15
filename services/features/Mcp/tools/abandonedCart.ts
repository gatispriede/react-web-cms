/**
 * Phase 1.B-d — Abandoned-cart MCP tools.
 *
 * Four families:
 *
 *   - `cart.abandoned.list { rangeHours?, limit? }` — recent abandonments
 *     for the admin observability table.
 *   - `cart.abandoned.stats { rangeHours? }`       — recovery-rate +
 *                                                    conversion counts.
 *   - `cart.abandoned.config.get`                  — read the three
 *                                                    `commerce.abandonedCart*`
 *                                                    flags + registered
 *                                                    metadata.
 *   - `cart.abandoned.config.set { path, value }`  — flip one flag
 *                                                    (path-prefix gated
 *                                                    to `commerce.abandonedCart*`).
 *
 * Cargo-cult of `checkout.ts` (flag get/set) + `warehouseSync.ts` (the
 * worker-port module slot pattern). The `IAbandonedCartPort` instance is
 * stamped in at boot by `CheckoutFeatureLoader` once the worker lands;
 * MCP-only reads (`list` / `stats`) gracefully return `{ok:false}` when
 * the slot is empty so a fresh dev boot doesn't crash on first call.
 *
 * Append-only registration — `Mcp/tools/index.ts` imports
 * `ABANDONED_CART_TOOLS` and spreads it into `ALL_MCP_TOOLS`.
 */
import type {McpTool} from '../types';
import {defineTool} from './_shared';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {COMMERCE_FLAG_PATHS} from '@services/features/Commerce/commerceFlags';
import {getFlagDefinition} from '@services/features/Seo/siteFlagDefinitions';
import type {IAbandonedCartPort} from '@services/features/Checkout/AbandonedCartWorker';

// ──────────────────────────────────────────────────────────────────────
// Module-scoped port slot — same pattern as `warehouseSync.ts`. The
// CheckoutFeatureLoader stamps the live port in at boot; tests replace
// via the `__setAbandonedCartPortForTests` seam.
// ──────────────────────────────────────────────────────────────────────

let portRef: IAbandonedCartPort | null = null;

/** Called by CheckoutFeatureLoader.onBoot() — stamps the live port in. */
export function registerAbandonedCartPort(p: IAbandonedCartPort | null): void {
    portRef = p;
}

/** Test seam — wipe / inject the port so each test starts clean. */
export function __setAbandonedCartPortForTests(p: IAbandonedCartPort | null): void {
    portRef = p;
}

const ABANDONED_PREFIX = 'commerce.abandonedCart';

/** Stable list of `commerce.abandonedCart*` flag paths (3 of them). */
function abandonedCartFlagPaths(): readonly string[] {
    return COMMERCE_FLAG_PATHS.filter(p => p.startsWith(ABANDONED_PREFIX));
}

// ──────────────────────────────────────────────────────────────────────
// cart.abandoned.list
// ──────────────────────────────────────────────────────────────────────

export const cartAbandonedList: McpTool = defineTool({
    name: 'cart.abandoned.list',
    description: 'List recent abandoned-cart candidates for the admin observability table. Returns cartId, customerId, updatedAt, recoveryEmailSentAt, status (active | recovered | converted | abandoned), subtotal, currency. Read-only — no mutation.',
    scopes: ['read:site'],
    inputSchema: {
        type: 'object',
        properties: {
            rangeHours: {type: 'integer', minimum: 1, maximum: 24 * 30, description: 'Window to look back, in hours. Default 72.'},
            limit: {type: 'integer', minimum: 1, maximum: 500, description: 'Max rows to return. Default 100.'},
        },
    },
}, async (args) => {
    if (!portRef) return {ok: false, error: 'abandoned-cart-port-not-registered'};
    const rangeHours = Math.min(24 * 30, Math.max(1, Number(args.rangeHours ?? 72)));
    const limit = Math.min(500, Math.max(1, Number(args.limit ?? 100)));
    try {
        const rows = await portRef.listRecent(rangeHours, limit);
        return {rows, rangeHours, limit};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

// ──────────────────────────────────────────────────────────────────────
// cart.abandoned.stats
// ──────────────────────────────────────────────────────────────────────

export const cartAbandonedStats: McpTool = defineTool({
    name: 'cart.abandoned.stats',
    description: 'Aggregate counters for the abandoned-cart pane: recovery emails sent, carts recovered (converted to orders), still-active carts, and abandoned-without-recovery counts. Computes recovery rate = recovered / recoveryEmailsSent (0 when no emails sent yet).',
    scopes: ['read:site'],
    inputSchema: {
        type: 'object',
        properties: {
            rangeHours: {type: 'integer', minimum: 1, maximum: 24 * 30, description: 'Window in hours. Default 168 (7d).'},
        },
    },
}, async (args) => {
    if (!portRef) return {ok: false, error: 'abandoned-cart-port-not-registered'};
    const rangeHours = Math.min(24 * 30, Math.max(1, Number(args.rangeHours ?? 168)));
    try {
        const counts = await portRef.countStats(rangeHours);
        const sent = counts.recoveryEmailsSent;
        const recovered = counts.recovered;
        const recoveryRate = sent > 0 ? recovered / sent : 0;
        return {
            rangeHours,
            recoveryEmailsSent: sent,
            recovered,
            active: counts.active,
            abandoned: counts.abandoned,
            sentButNotRecovered: Math.max(0, sent - recovered),
            recoveryRate,
        };
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

// ──────────────────────────────────────────────────────────────────────
// cart.abandoned.config.get / .set — thin flag wrappers
// ──────────────────────────────────────────────────────────────────────

export const cartAbandonedConfigGet: McpTool = defineTool({
    name: 'cart.abandoned.config.get',
    description: 'Read every commerce.abandonedCart* flag (enabled / delayMinutes / discountCode) with definitions + defaults. Use this before rendering the admin pane so the operator sees actual live values, not the form defaults.',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    try {
        const raw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(raw);
        const commerce = (flags?.commerce ?? {}) as Record<string, unknown>;
        const paths = abandonedCartFlagPaths();
        const definitions = paths.map(path => {
            const def = getFlagDefinition(path);
            const key = path.slice('commerce.'.length);
            return {
                path,
                value: commerce[key] ?? def?.defaultValue,
                defaultValue: def?.defaultValue,
                description: def?.description,
                audience: def?.audience ?? 'admin-only',
            };
        });
        return {commerce, definitions};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const cartAbandonedConfigSet: McpTool = defineTool({
    name: 'cart.abandoned.config.set',
    description: 'Set one commerce.abandonedCart* flag — abandonedCartEnabled (bool), abandonedCartDelayMinutes (number), abandonedCartDiscountCode (string). Type-guard-validated against the registered definition. Audit-logged.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'commerceFlags',
    gqlMutation: 'saveSiteFlags',
    inputSchema: {
        type: 'object',
        required: ['path', 'value'],
        properties: {
            path: {type: 'string', description: 'Dotted flag path, e.g. commerce.abandonedCartEnabled.'},
            value: {type: 'string', description: 'New value; type-guarded against the registered flag definition. Pass as JSON string for non-strings.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'cart.abandoned.config.set');
    const path = String(args.path ?? '');
    if (!path.startsWith(ABANDONED_PREFIX)) {
        return {ok: false, error: `cart.abandoned.config.set: path must start with '${ABANDONED_PREFIX}', got '${path}'`};
    }
    const def = getFlagDefinition(path);
    if (!def) {
        return {ok: false, error: `cart.abandoned.config.set: unknown flag '${path}'. Registered: ${abandonedCartFlagPaths().join(', ')}.`};
    }
    if (!def.typeGuard(args.value)) {
        return {ok: false, error: `cart.abandoned.config.set: value failed type-guard for '${path}'`};
    }
    const key = path.slice('commerce.'.length);
    try {
        const raw = await getMongoConnection().saveSiteFlags({
            flags: {commerce: {[key]: args.value}},
            _session: {email: ctx.actor},
        });
        return {ok: true, result: JSON.parse(raw)};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const ABANDONED_CART_TOOLS: McpTool[] = [
    cartAbandonedList,
    cartAbandonedStats,
    cartAbandonedConfigGet,
    cartAbandonedConfigSet,
];
