import {spawn} from 'node:child_process';
import * as path from 'node:path';
import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';
import {listFlagDefinitions, parseFlagPath} from '@services/features/Seo/siteFlagDefinitions';

/**
 * site.revalidate — fires a fire-and-forget POST to the /api/revalidate route
 * the Next runtime serves. Mirrors the inline helper used by InventoryService
 * (services/infra/mongoDBConnection.ts: triggerRevalidate). Reads
 * REVALIDATE_HOST / NEXT_PUBLIC_SITE_URL from env; if neither is set we
 * return a structured "skipped" response so the agent knows it was a no-op.
 */
export const siteRevalidate: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct ISR endpoint
    name: 'site.revalidate',
    description: 'Triggers an ISR revalidate. scope=all (the default) revalidates every static page; scope=page revalidates a single slug.',
    scopes: ['write:site'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        properties: {
            scope: {type: 'string', enum: ['all', 'page'], default: 'all'},
            slug: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'site.revalidate');
    const scope = (args.scope ?? 'all') as 'all' | 'page';
    const host = (process.env.REVALIDATE_HOST || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    if (!host) {
        return {revalidated: false, reason: 'REVALIDATE_HOST / NEXT_PUBLIC_SITE_URL not set'};
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
        return {revalidated: res.ok, status: res.status, scope: body.scope, slug: (body as any).slug};
    } catch (err) {
        return {revalidated: false, error: String((err as Error).message || err)};
    }
});

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
export const siteRegenerateSchema: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — spawns the codegen script
    name: 'site.regenerateSchema',
    description: 'Regenerate the gqty client (services/api/generated/) from schema.graphql. Self-spawns a temp graphql server — no dev server required. Run after editing the schema.',
    scopes: ['write:site'],
    rateLimit: {maxPerMinute: 5},
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => {
    await enforceModeForTool(ctx.actor, 'site.regenerateSchema');
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
            resolve({
                ok: code === 0,
                exitCode: code,
                stdout: tail(stdout),
                stderr: tail(stderr),
            });
        });
        child.on('error', (err) => {
            resolve({ok: false, error: String((err as Error).message || err)});
        });
    });
});

/**
 * auth.resetLockouts — clear the in-process login-lockout bucket. Posts
 * to `/api/auth/reset-lockout` carrying the MCP token as Bearer auth;
 * the endpoint validates the token + checks for the `admin:auth` scope
 * on the server side. The CMS host is read from the same env vars as
 * `site.revalidate` so the configuration stays in one place.
 */
export const authResetLockouts: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct admin HTTP endpoint
    name: 'auth.resetLockouts',
    description: 'Clear all login-lockout buckets — unlock any account that hammered wrong passwords. Requires the MCP token to carry the admin:auth scope.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'auth',
    rateLimit: {maxPerMinute: 10},
    inputSchema: {
        type: 'object',
        properties: {
            idempotencyKey: {type: 'string'},
        },
    },
}, async (_args, ctx) => {
    await enforceModeForTool(ctx.actor, 'auth.resetLockouts');
    const host = (process.env.REVALIDATE_HOST || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    if (!host) {
        return {ok: false, reason: 'REVALIDATE_HOST / NEXT_PUBLIC_SITE_URL not set'};
    }
    // The MCP dispatcher stashes the raw secret on the context for
    // exactly this kind of "tool needs to call back into the CMS
    // over HTTP" case. If it's missing, decline rather than silently
    // hitting the endpoint without auth.
    const tokenSecret = (ctx as any)?.tokenSecret as string | undefined;
    if (!tokenSecret) {
        return {ok: false, reason: 'MCP token secret not available on context'};
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
        return {ok: res.ok, status: res.status, body};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

/**
 * site.featureFlags — runtime view of which feature manifests are active.
 */
export const siteFeatureFlags: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — read-only query
    name: 'site.featureFlags',
    description: 'Runtime view of feature manifests — id, displayName, enabled, coreInfrastructure, requires, envKey. Read-only; flipping a flag needs an env var + restart.',
    scopes: ['read:site'],
    auditScope: 'featureFlags',
    inputSchema: {type: 'object', properties: {}},
}, async (_args, _ctx) => {
    try {
        const raw = await getMongoConnection().getFeatureFlags();
        const parsed = JSON.parse(raw);
        return {features: Array.isArray(parsed) ? parsed : []};
    } catch (err) {
        return {error: String((err as Error).message || err)};
    }
});

/**
 * site.setFeatureFlag — write override row for a plug-and-play feature.
 */
export const siteSetFeatureFlag: McpTool = defineTool({
    name: 'site.setFeatureFlag',
    description: 'Persist a plug-and-play feature toggle override (id + enabled bool). Runtime gates pick it up immediately; boot-side schema/services need a restart to fully reappear.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'featureFlags',
    gqlMutation: 'setFeatureFlag',
    inputSchema: {
        type: 'object',
        required: ['id', 'enabled'],
        properties: {
            id: {type: 'string', description: 'Feature manifest id, e.g. cart, products.'},
            enabled: {type: 'boolean'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'site.setFeatureFlag');
    try {
        const raw = await getMongoConnection().setFeatureFlag({
            id: args.id,
            enabled: !!args.enabled,
            _session: {email: ctx.actor},
        });
        return {ok: true, result: JSON.parse(raw)};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

/**
 * site.clearFeatureFlag — drop the override row.
 */
export const siteClearFeatureFlag: McpTool = defineTool({
    name: 'site.clearFeatureFlag',
    description: 'Drop a feature toggle override; the feature falls back to env / default behaviour.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'featureFlags',
    gqlMutation: 'clearFeatureFlag',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'site.clearFeatureFlag');
    try {
        const raw = await getMongoConnection().clearFeatureFlag({id: args.id, _session: {email: ctx.actor}});
        return {ok: true, result: JSON.parse(raw)};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const sitePublish: McpTool = defineTool({
    name: 'site.publish',
    description: 'Creates a publish snapshot that makes all saved content live. Call this after any write session.',
    scopes: ['write:site'],
    idempotent: true,
    gqlMutation: 'publishSnapshot',
    inputSchema: {
        type: 'object',
        properties: {
            note: {type: 'string', description: 'Optional human-readable note logged with the snapshot.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    try {
        const raw = await getMongoConnection().publishSnapshot({note: args.note, _session: {email: ctx.actor}});
        const result = JSON.parse(raw);
        // W8h SEO polish — non-blocking pre-flight: run the SEO meta
        // audit and attach its warnings to the publish result. The
        // operator can dismiss; we never fail the publish on a soft
        // warning. Any pre-flight error is swallowed silently — a
        // missing pre-flight is far less harmful than a blocked
        // publish on a broken audit.
        try {
            const {runSeoPreflight} = await import('./seo');
            const preflight = await runSeoPreflight();
            (result as any).seoPreflight = preflight;
        } catch { /* tolerate — never block publish on preflight failure */ }
        return result;
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const siteGetPublishHistory: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'site.getPublishHistory',
    description: 'Returns the N most recent publish snapshots (default 20). Useful for auditing what changed and when.',
    scopes: ['read:site'],
    inputSchema: {
        type: 'object',
        properties: {
            limit: {type: 'integer', minimum: 1, maximum: 200, default: 20},
        },
    },
}, async (args, _ctx) => {
    try {
        const raw = await getMongoConnection().getPublishedHistory({limit: args.limit ?? 20});
        return JSON.parse(raw);
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const siteSetLayoutMode: McpTool = defineTool({
    name: 'site.setLayoutMode',
    description: 'Set siteFlags.layoutMode — the site-mode toggle (F6). "tabs" (each page at its own URL — F1 sub-pages render here, N canonical URLs), "scroll" (all pages stacked on one scrolling page; nav uses #anchor links; SiteFooter rewrites page URLs to anchors; single canonical URL; deep page paths hard-redirect to /#anchor), "auto" (resolves to "tabs" — pick this when no preference). SEO impact: switching collapses or expands the indexed surface — after flipping, call site.publish then site.revalidate { scope: "all" } and regenerate the sitemap. See docs/runbooks/site-mode-switch.md.',
    scopes: ['write:site'],
    idempotent: true,
    gqlMutation: 'saveSiteFlags',
    inputSchema: {
        type: 'object',
        required: ['mode'],
        properties: {
            mode: {type: 'string', enum: ['tabs', 'scroll', 'auto']},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    try {
        const raw = await getMongoConnection().saveSiteFlags({
            flags: {layoutMode: args.mode as 'tabs' | 'scroll' | 'auto'},
            _session: {email: ctx.actor},
        });
        return JSON.parse(raw);
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

/**
 * site.flagDefinitions.list — introspection over the `defineFlag()`
 * registry. Lets the admin settings UI render namespaced flags
 * generically (no hardcoded form per flag) and lets MCP clients
 * discover which flags exist + their defaults without scraping the
 * source. Optional `byNamespace` groups the response by sub-record
 * (commerce / auth / theme / seo) for a cleaner UI.
 *
 * Note: this surfaces only the new sub-record flags registered via
 * `defineFlag()`. Legacy top-level flags (`blogEnabled`, `layoutMode`,
 * …) are not exposed here — they remain readable through their
 * existing read paths.
 */
export const siteFlagDefinitionsList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — pure registry read
    name: 'site.flagDefinitions.list',
    description: 'List registered site-flag definitions (path, default, audience, description). Use byNamespace=true to group by commerce/auth/theme/seo. Powers generic admin flag UIs.',
    scopes: ['read:site'],
    inputSchema: {
        type: 'object',
        properties: {
            byNamespace: {type: 'boolean', default: false},
        },
    },
}, async (args, _ctx) => {
    const defs = listFlagDefinitions().map(d => ({
        path: d.path,
        defaultValue: d.defaultValue,
        audience: d.audience ?? 'admin-only',
        description: d.description,
    }));
    if (!args.byNamespace) {
        return {flags: defs};
    }
    const grouped: Record<string, typeof defs> = {commerce: [], auth: [], theme: [], seo: []};
    for (const d of defs) {
        const {ns} = parseFlagPath(d.path as any);
        (grouped[ns] ||= []).push(d);
    }
    return {byNamespace: grouped};
});

export const SITE_TOOLS: McpTool[] = [
    siteRevalidate,
    siteRegenerateSchema,
    authResetLockouts,
    siteFeatureFlags,
    siteSetFeatureFlag,
    siteClearFeatureFlag,
    sitePublish,
    siteGetPublishHistory,
    siteSetLayoutMode,
    siteFlagDefinitionsList,
];
