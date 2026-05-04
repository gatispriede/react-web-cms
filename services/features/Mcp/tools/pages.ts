import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';

const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});

function safeParse(s: string): unknown {
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

export const pageList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'page.list',
    description: 'Returns the navigation tree (every page) plus high-level metadata.',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => ctx.services.navigationService.getNavigationCollection());

export const pageGet: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'page.get',
    description: 'Returns one page by name plus the resolved sections in order.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['page'],
        properties: {page: {type: 'string', minLength: 1}},
    },
}, async (args, ctx) => {
    const navs = await ctx.services.navigationService.getNavigationCollection();
    const nav = (navs ?? []).find((n: any) => n.page === args.page);
    if (!nav) return {page: args.page, found: false};
    const sectionIds = (nav.sections ?? []) as string[];
    const sections = sectionIds.length
        ? await ctx.services.navigationService.getSections(sectionIds)
        : [];
    return {page: args.page, navigation: nav, sections};
});

export const pageCreate: McpTool = defineTool({
    // SAFE: routes through navigationService directly, not the
    // addUpdateNavigationItem GraphQL mutation (the arg shape differs).
    name: 'page.create',
    description: 'Creates a new navigation entry (empty sections list).',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['page'],
        properties: {
            page: {type: 'string', minLength: 1},
            sections: {type: 'array', items: {type: 'string'}, default: []},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const res = await ctx.services.navigationService.addUpdateNavigationItem(
        args.page,
        args.sections ?? [],
        ctx.actor,
    );
    return typeof res === 'string' ? safeParse(res) : res;
});

export const sectionUpdate: McpTool = defineTool({
    name: 'section.update',
    description: 'Upserts a section (the `content` JSON is run through the same DOMPurify pipeline as the admin UI).',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'addUpdateSectionItem',
    inputSchema: {
        type: 'object',
        required: ['section'],
        properties: {
            section: {type: 'object', properties: {}},
            pageName: {type: 'string'},
            expectedVersion: {type: 'integer'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const res = await ctx.services.addUpdateSectionItem({
        section: args.section,
        pageName: args.pageName,
        expectedVersion: args.expectedVersion ?? null,
        _session: sessionFor(ctx.actor),
    });
    return typeof res === 'string' ? safeParse(res) : res;
});

export const sectionDelete: McpTool = defineTool({
    name: 'section.delete',
    description: 'Removes a section by id.',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'removeSectionItem',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'section.delete');
    const res = await ctx.services.removeSectionItem({id: args.id, _session: sessionFor(ctx.actor)});
    return typeof res === 'string' ? safeParse(res) : res;
});

export const PAGE_TOOLS: McpTool[] = [pageList, pageGet, pageCreate, sectionUpdate, sectionDelete];
