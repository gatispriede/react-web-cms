/**
 * F8 Week-2 — site-wide content tools (footer, SEO, site flags, logo).
 *
 * Each tool is a thin wrapper over an existing service; no new service
 * methods. The connection facade methods (`getFooter`, `saveFooter`,
 * `getSiteSeo`, `saveSiteSeo`, `getSiteFlags`, `saveSiteFlags`,
 * `getLogo`, `saveLogo`) all return JSON strings, so tools normalise
 * to objects.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';

function safeParse(s: unknown): unknown {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

const sessionFor = (actor: string) => ({email: actor});

export const footerGet: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct service read
    name: 'footer.get',
    description: 'Returns the current footer config (columns, bottom strip, version).',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => ctx.services.footerService.get());

export const footerUpdate: McpTool = defineTool({
    name: 'footer.update',
    description: 'Replace the footer config. Sanitised server-side (column / entry caps).',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'saveFooter',
    inputSchema: {
        type: 'object',
        required: ['config'],
        properties: {
            config: {type: 'object', properties: {}},
            expectedVersion: {type: 'integer'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'footer.update');
    const conn: any = ctx.services;
    const res = await conn.saveFooter({
        config: args.config,
        expectedVersion: args.expectedVersion ?? null,
        _session: sessionFor(ctx.actor),
    });
    return safeParse(res);
});

export const seoGet: McpTool = defineTool({
    // SAFE: composite read — siteSeo + siteFlags
    name: 'seo.get',
    description: 'Returns the site-wide SEO defaults plus the site flags doc.',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => {
    const [siteSeo, siteFlags] = await Promise.all([
        ctx.services.siteSeoService.get(),
        ctx.services.siteFlagsService.get(),
    ]);
    return {siteSeo, siteFlags};
});

export const seoUpdate: McpTool = defineTool({
    // SAFE: routes to two mutations conditionally
    name: 'seo.update',
    description: 'Save the site SEO defaults and/or the site flags. Each block updates only if the corresponding key is present.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        properties: {
            siteSeo: {type: 'object', properties: {}},
            siteFlags: {type: 'object', properties: {}},
            expectedVersion: {type: 'integer'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'seo.update');
    const conn: any = ctx.services;
    const out: Record<string, unknown> = {};
    if (args.siteSeo && typeof args.siteSeo === 'object') {
        const res = await conn.saveSiteSeo({
            seo: args.siteSeo,
            expectedVersion: args.expectedVersion ?? null,
            _session: sessionFor(ctx.actor),
        });
        out.siteSeo = safeParse(res);
    }
    if (args.siteFlags && typeof args.siteFlags === 'object') {
        const res = await conn.saveSiteFlags({
            flags: args.siteFlags,
            expectedVersion: args.expectedVersion ?? null,
            _session: sessionFor(ctx.actor),
        });
        out.siteFlags = safeParse(res);
    }
    return out;
});

export const logoGet: McpTool = defineTool({
    // SAFE: AssetService.getLogo — direct read
    name: 'logo.get',
    description: 'Returns the current site logo asset metadata (URL, version).',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => {
    const conn: any = ctx.services;
    return safeParse(await conn.getLogo());
});

export const logoUpdate: McpTool = defineTool({
    name: 'logo.update',
    description: 'Save / replace the site logo. `content` is the SVG (string) or data-URL payload accepted by the AssetService.',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'saveLogo',
    inputSchema: {
        type: 'object',
        required: ['content'],
        properties: {
            content: {type: 'string', minLength: 1},
            expectedVersion: {type: 'integer'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'logo.update');
    const conn: any = ctx.services;
    const res = await conn.saveLogo({
        content: args.content,
        expectedVersion: args.expectedVersion ?? null,
        _session: sessionFor(ctx.actor),
    });
    return safeParse(res);
});

export const SITE_CONTENT_TOOLS: McpTool[] = [
    footerGet, footerUpdate,
    seoGet, seoUpdate,
    logoGet, logoUpdate,
];
