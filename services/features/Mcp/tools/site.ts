import {spawn} from 'node:child_process';
import * as path from 'node:path';
import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

/**
 * site.revalidate — fires a fire-and-forget POST to the /api/revalidate route
 * the Next runtime serves. Mirrors the inline helper used by InventoryService
 * (services/infra/mongoDBConnection.ts: triggerRevalidate). Reads
 * REVALIDATE_HOST / NEXT_PUBLIC_SITE_URL from env; if neither is set we
 * return a structured "skipped" response so the agent knows it was a no-op.
 */
export const siteRevalidate: McpTool = {
    name: 'site.revalidate',
    description: 'Triggers an ISR revalidate. scope=all (the default) revalidates every static page; scope=page revalidates a single slug.',
    scopes: ['write:site'],
    inputSchema: {
        type: 'object',
        properties: {
            scope: {type: 'string', enum: ['all', 'page'], default: 'all'},
            slug: {type: 'string'},
        },
    },
    handler: async (args, _ctx) => {
        const scope = (args.scope ?? 'all') as 'all' | 'page';
        const host = (process.env.REVALIDATE_HOST || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
        if (!host) {
            return ok({revalidated: false, reason: 'REVALIDATE_HOST / NEXT_PUBLIC_SITE_URL not set'});
        }
        try {
            const body = scope === 'page' && args.slug
                ? {scope: 'page', slug: args.slug}
                : {scope: 'all'};
            const res = await fetch(`${host}/api/revalidate`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body),
            });
            return ok({revalidated: res.ok, status: res.status, scope: body.scope, slug: (body as any).slug});
        } catch (err) {
            return ok({revalidated: false, error: String((err as Error).message || err)});
        }
    },
};

/**
 * site.regenerateSchema — runs `tools/generate-schema.js` to refresh the
 * gqty client (`services/api/generated/`) against the current
 * `services/api/schema.graphql`. The script self-spawns its own
 * `mongodb-memory-server` + standalone GraphQL, so the agent doesn't
 * need a dev server up. Useful after editing `schema.graphql` from an
 * AI session — the agent can finish the round trip without leaving the
 * MCP loop. Returns the codegen stdout/stderr tail so the agent can
 * see what changed (or what failed).
 */
export const siteRegenerateSchema: McpTool = {
    name: 'site.regenerateSchema',
    description: 'Regenerate the gqty client (services/api/generated/) from schema.graphql. Self-spawns a temp graphql server — no dev server required. Run after editing the schema.',
    scopes: ['write:site'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, _ctx) => {
        // Resolve the script relative to this file so the tool works from
        // both the bundled MCP server and `npm run mcp:stdio` against the
        // workspace tree.
        const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
        const scriptPath = path.join(repoRoot, 'tools', 'generate-schema.js');

        return await new Promise((resolve) => {
            const child = spawn(process.execPath, [scriptPath], {
                cwd: repoRoot,
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (d) => { stdout += d.toString(); });
            child.stderr?.on('data', (d) => { stderr += d.toString(); });
            child.on('exit', (code) => {
                // Trim to the last 4 KB each — codegen output is mostly
                // banner noise, the agent only needs the tail.
                const tail = (s: string) => s.length > 4096 ? s.slice(-4096) : s;
                resolve(ok({
                    ok: code === 0,
                    exitCode: code,
                    stdout: tail(stdout),
                    stderr: tail(stderr),
                }));
            });
            child.on('error', (err) => {
                resolve(ok({ok: false, error: String((err as Error).message || err)}));
            });
        });
    },
};

/**
 * auth.resetLockouts — clear the in-process login-lockout bucket. Posts
 * to `/api/auth/reset-lockout` carrying the MCP token as Bearer auth;
 * the endpoint validates the token + checks for the `admin:auth` scope
 * on the server side. The CMS host is read from the same env vars as
 * `site.revalidate` so the configuration stays in one place.
 */
export const authResetLockouts: McpTool = {
    name: 'auth.resetLockouts',
    description: 'Clear all login-lockout buckets — unlock any account that hammered wrong passwords. Requires the MCP token to carry the admin:auth scope.',
    scopes: ['admin:auth'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, ctx) => {
        const host = (process.env.REVALIDATE_HOST || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
        if (!host) {
            return ok({ok: false, reason: 'REVALIDATE_HOST / NEXT_PUBLIC_SITE_URL not set'});
        }
        // The MCP dispatcher stashes the raw secret on the context for
        // exactly this kind of "tool needs to call back into the CMS
        // over HTTP" case. If it's missing, decline rather than silently
        // hitting the endpoint without auth.
        const tokenSecret = (ctx as any)?.tokenSecret as string | undefined;
        if (!tokenSecret) {
            return ok({ok: false, reason: 'MCP token secret not available on context'});
        }
        try {
            const res = await fetch(`${host}/api/auth/reset-lockout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokenSecret}`,
                },
            });
            const body = await res.json().catch(() => null);
            return ok({ok: res.ok, status: res.status, body});
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

/**
 * site.featureFlags — runtime view of which feature manifests are active.
 * Mirrors the `getFeatureFlags` GraphQL field. Read-only; flipping a flag
 * still requires an env-var + restart in v1. Useful for an AI client to
 * answer "is the cart on?" without screen-scraping the admin panel.
 */
export const siteFeatureFlags: McpTool = {
    name: 'site.featureFlags',
    description: 'Runtime view of feature manifests — id, displayName, enabled, coreInfrastructure, requires, envKey. Read-only; flipping a flag needs an env var + restart.',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, _ctx) => {
        try {
            const raw = await getMongoConnection().getFeatureFlags();
            const parsed = JSON.parse(raw);
            return ok({features: Array.isArray(parsed) ? parsed : []});
        } catch (err) {
            return ok({error: String((err as Error).message || err)});
        }
    },
};

/**
 * site.setFeatureFlag — write override row for a plug-and-play feature.
 * Persists to Mongo and refreshes the in-process cache so subsequent
 * `isFeatureEnabled` reads (route gates, etc.) pick up the value
 * immediately. Boot-side decisions (schema/resolver composition,
 * services factory) still need a server restart to fully reappear.
 */
export const siteSetFeatureFlag: McpTool = {
    name: 'site.setFeatureFlag',
    description: 'Persist a plug-and-play feature toggle override (id + enabled bool). Runtime gates pick it up immediately; boot-side schema/services need a restart to fully reappear.',
    scopes: ['write:site'],
    inputSchema: {
        type: 'object',
        required: ['id', 'enabled'],
        properties: {
            id: {type: 'string', description: 'Feature manifest id, e.g. cart, products.'},
            enabled: {type: 'boolean'},
        },
    },
    handler: async (args, ctx) => {
        try {
            const raw = await getMongoConnection().setFeatureFlag({
                id: args.id,
                enabled: !!args.enabled,
                _session: {email: ctx.actor},
            });
            return ok({ok: true, result: JSON.parse(raw)});
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

/**
 * site.clearFeatureFlag — drop the override row so a feature falls
 * back to env / default behaviour.
 */
export const siteClearFeatureFlag: McpTool = {
    name: 'site.clearFeatureFlag',
    description: 'Drop a feature toggle override; the feature falls back to env / default behaviour.',
    scopes: ['write:site'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string'}},
    },
    handler: async (args, ctx) => {
        try {
            const raw = await getMongoConnection().clearFeatureFlag({id: args.id, _session: {email: ctx.actor}});
            return ok({ok: true, result: JSON.parse(raw)});
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

export const SITE_TOOLS: McpTool[] = [
    siteRevalidate,
    siteRegenerateSchema,
    authResetLockouts,
    siteFeatureFlags,
    siteSetFeatureFlag,
    siteClearFeatureFlag,
];
