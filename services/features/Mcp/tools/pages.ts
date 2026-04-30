import {McpTool} from '../types';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});

export const pageList: McpTool = {
    name: 'page.list',
    description: 'Returns the navigation tree (every page) plus high-level metadata.',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, ctx) => {
        const navs = await ctx.services.navigationService.getNavigationCollection();
        return ok(navs);
    },
};

export const pageGet: McpTool = {
    name: 'page.get',
    description: 'Returns one page by name plus the resolved sections in order.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['page'],
        properties: {page: {type: 'string', minLength: 1}},
    },
    handler: async (args, ctx) => {
        const navs = await ctx.services.navigationService.getNavigationCollection();
        const nav = (navs ?? []).find((n: any) => n.page === args.page);
        if (!nav) return ok({page: args.page, found: false});
        const sectionIds = (nav.sections ?? []) as string[];
        const sections = sectionIds.length
            ? await ctx.services.navigationService.getSections(sectionIds)
            : [];
        return ok({page: args.page, navigation: nav, sections});
    },
};

export const pageCreate: McpTool = {
    name: 'page.create',
    description: 'Creates a new navigation entry (empty sections list).',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['page'],
        properties: {
            page: {type: 'string', minLength: 1},
            sections: {type: 'array', items: {type: 'string'}, default: []},
        },
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.navigationService.addUpdateNavigationItem(
            args.page,
            args.sections ?? [],
            ctx.actor,
        );
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const sectionUpdate: McpTool = {
    name: 'section.update',
    description: 'Upserts a section (the `content` JSON is run through the same DOMPurify pipeline as the admin UI).',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['section'],
        properties: {
            section: {type: 'object', properties: {}},
            pageName: {type: 'string'},
            expectedVersion: {type: 'integer'},
        },
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.addUpdateSectionItem({
            section: args.section,
            pageName: args.pageName,
            expectedVersion: args.expectedVersion ?? null,
            _session: sessionFor(ctx.actor),
        });
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const sectionDelete: McpTool = {
    name: 'section.delete',
    description: 'Removes a section by id.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string', minLength: 1}},
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.removeSectionItem({id: args.id, _session: sessionFor(ctx.actor)});
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

function safeParse(s: string): unknown {
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

export const PAGE_TOOLS: McpTool[] = [pageList, pageGet, pageCreate, sectionUpdate, sectionDelete];
