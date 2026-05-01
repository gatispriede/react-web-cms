import {spawn} from 'node:child_process';
import * as path from 'node:path';
import {McpTool} from '../types';

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

export const SITE_TOOLS: McpTool[] = [siteRevalidate, siteRegenerateSchema];
