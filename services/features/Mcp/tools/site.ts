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

export const SITE_TOOLS: McpTool[] = [siteRevalidate];
