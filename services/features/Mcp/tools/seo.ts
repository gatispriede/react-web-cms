/**
 * MCP tools for the W8h SEO program — redirects CRUD + meta pre-flight.
 *
 *   redirect.list   — read every row
 *   redirect.create — add a new exact-path redirect
 *   redirect.update — edit an existing redirect (version-checked)
 *   redirect.delete — drop a redirect
 *   seo.preflight   — meta pre-flight validator: returns warnings
 *                     (title length, description length, missing OG
 *                     image, missing canonical) per page about to
 *                     publish. Wired into `site.publish` flow as a
 *                     non-blocking notice.
 */
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool} from './_shared';
import type {IRedirect} from '@interfaces/IRedirect';

export const redirectList: McpTool = defineTool({
    // SAFE: read-only, not a GraphQL mutation
    name: 'redirect.list',
    description: 'Returns every redirect in the operator-editable table. Each row carries `{from, to, code, note, expiresAt?, createdAt, editedBy, editedAt, version}`.',
    scopes: ['read:site'],
    auditScope: 'seo',
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    const svc = getMongoConnection().redirectsService;
    if (!svc) return {redirects: []};
    return {redirects: await svc.list()};
});

export const redirectCreate: McpTool = defineTool({
    name: 'redirect.create',
    description: 'Create an exact-path redirect. `from` is normalised to start with `/`; duplicate `from` rejects. `code` defaults to 301.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'seo',
    inputSchema: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
            from: {type: 'string', minLength: 1, description: 'Source path, e.g. /old-page'},
            to: {type: 'string', minLength: 1, description: 'Target — absolute URL or root-relative path'},
            code: {type: 'integer', enum: [301, 302], default: 301},
            note: {type: 'string'},
            expiresAt: {type: 'string', description: 'Optional ISO-8601 expiry'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'redirect.create');
    const svc = getMongoConnection().redirectsService;
    if (!svc) throw new Error('redirects service not available');
    const input: IRedirect = {
        from: String(args.from),
        to: String(args.to),
        code: args.code === 302 ? 302 : 301,
        note: args.note,
        expiresAt: args.expiresAt ?? null,
    };
    return await svc.create(input, ctx.actor);
});

export const redirectUpdate: McpTool = defineTool({
    name: 'redirect.update',
    description: 'Update an existing redirect by id. Conflict-checked via `version`. Pass only the fields you want to change.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'seo',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            from: {type: 'string'},
            to: {type: 'string'},
            code: {type: 'integer', enum: [301, 302]},
            note: {type: 'string'},
            expiresAt: {type: ['string', 'null']},
            version: {type: 'integer'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'redirect.update');
    const svc = getMongoConnection().redirectsService;
    if (!svc) throw new Error('redirects service not available');
    return await svc.update(args as IRedirect, ctx.actor);
});

export const redirectDelete: McpTool = defineTool({
    name: 'redirect.delete',
    description: 'Delete a redirect by id.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'seo',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'redirect.delete');
    const svc = getMongoConnection().redirectsService;
    if (!svc) throw new Error('redirects service not available');
    return await svc.delete(String(args.id));
});

export interface PreflightWarning {
    page: string;
    severity: 'warn' | 'error';
    field: string;
    message: string;
}

export interface PreflightResult {
    pageCount: number;
    warningCount: number;
    warnings: PreflightWarning[];
}

/**
 * Pure pre-flight runner — exported so the publish flow (and tests) can
 * call into it directly without going through the MCP envelope wrapper.
 * The MCP tool below delegates here.
 */
export async function runSeoPreflight(targetPage?: string): Promise<PreflightResult> {
    const conn = getMongoConnection();
    const navs = await conn.navigationService.getNavigationCollection();
    const list = Array.isArray(navs) ? navs : [];
    const targets = typeof targetPage === 'string' && targetPage
        ? list.filter((n: any) => n.page === targetPage)
        : list;
    const warnings: PreflightWarning[] = [];
    for (const nav of targets as Array<{page: string; seo?: any}>) {
        const seo = nav.seo ?? {};
        warnings.push(...checkLengths(nav.page, seo.title, seo.description));
        if (!seo.image) {
            warnings.push({page: nav.page, severity: 'warn', field: 'og-image', message: 'No og:image set; falls back to site default'});
        }
        if (!seo.url) {
            warnings.push({page: nav.page, severity: 'warn', field: 'canonical', message: 'No canonical URL set; derived from request'});
        }
    }
    return {pageCount: targets.length, warningCount: warnings.length, warnings};
}

function checkLengths(page: string, title: string | undefined, description: string | undefined): PreflightWarning[] {
    const out: PreflightWarning[] = [];
    if (!title || title.trim().length === 0) {
        out.push({page, severity: 'warn', field: 'title', message: 'Page has no title'});
    } else if (title.length > 70) {
        out.push({page, severity: 'warn', field: 'title', message: `Title is ${title.length} chars (max 70 recommended)`});
    }
    if (!description || description.trim().length === 0) {
        out.push({page, severity: 'warn', field: 'description', message: 'Page has no meta description'});
    } else if (description.length > 175) {
        out.push({page, severity: 'warn', field: 'description', message: `Description is ${description.length} chars (max 175 recommended)`});
    }
    return out;
}

export const seoPreflight: McpTool = defineTool({
    // SAFE: read-only, not a GraphQL mutation
    name: 'seo.preflight',
    description: 'Meta pre-flight validator — for each public page returns warnings on title length, description length, missing OG image, missing canonical. Warnings (not errors) the operator can dismiss before publishing.',
    scopes: ['read:site'],
    auditScope: 'seo',
    inputSchema: {
        type: 'object',
        properties: {
            page: {type: 'string', description: 'Optional single page name — when omitted, every page is scanned.'},
        },
    },
}, async (args) => {
    return runSeoPreflight(typeof args.page === 'string' ? args.page : undefined);
});

export const SEO_TOOLS: McpTool[] = [
    redirectList,
    redirectCreate,
    redirectUpdate,
    redirectDelete,
    seoPreflight,
];
