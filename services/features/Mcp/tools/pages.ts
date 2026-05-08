import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool, runBatch} from './_shared';

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
    description: 'Upsert one or many sections. Single form: pass {section}. Bulk form: pass {items: ISection[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. The `content` JSON is run through the same DOMPurify pipeline as the admin UI. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'addUpdateSectionItem',
    inputSchema: {
        type: 'object',
        properties: {
            section: {type: 'object', properties: {}, description: 'Single-item form. Mutually exclusive with `items`.'},
            pageName: {type: 'string'},
            expectedVersion: {type: 'integer'},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        section: {type: 'object', properties: {}},
                        pageName: {type: 'string'},
                        expectedVersion: {type: 'integer'},
                    },
                },
                description: 'Bulk variant. Each item is {section, pageName?, expectedVersion?}. Up to 500 items. Mutually exclusive with single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({
            id: String(it?.section?.id ?? `idx:${i}`),
            payload: it,
        }))
        : (args.section ? [{
            id: String(args.section?.id ?? 'idx:0'),
            payload: {section: args.section, pageName: args.pageName, expectedVersion: args.expectedVersion},
        }] : []);
    if (!items.length) {
        throw new Error('section.update requires `section` or non-empty `items[]`');
    }

    const batch = await runBatch(items, async (_id, payload) => {
        const res = await ctx.services.addUpdateSectionItem({
            section: payload.section,
            pageName: payload.pageName,
            expectedVersion: payload.expectedVersion ?? null,
            _session: sessionFor(ctx.actor),
        });
        return {result: typeof res === 'string' ? safeParse(res) : res};
    });

    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
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

async function applyPageUpdate(ctx: any, args: any): Promise<any> {
    const navs = await ctx.services.navigationService.getNavigationCollection();
    const row = (navs ?? []).find((n: any) => n.id === args.id);
    if (!row) return {error: 'page-not-found', id: args.id};
    let renameRes: unknown;
    if (typeof args.page === 'string' && args.page !== row.page) {
        const merged = {...row, page: args.page, slug: args.slug ?? row.slug};
        const res = await ctx.services.navigationService.replaceUpdateNavigation(
            row.page, merged as any, ctx.actor,
        );
        renameRes = typeof res === 'string' ? safeParse(res) : res;
    } else if (typeof args.slug === 'string' && args.slug !== row.slug) {
        const merged = {...row, slug: args.slug};
        const res = await ctx.services.navigationService.replaceUpdateNavigation(
            row.page, merged as any, ctx.actor,
        );
        renameRes = typeof res === 'string' ? safeParse(res) : res;
    }
    let parentRes: unknown;
    if (Object.prototype.hasOwnProperty.call(args, 'parent')) {
        const parentId = args.parent === null || args.parent === '' ? null : args.parent;
        const res = await ctx.services.navigationService.setParent(args.id, parentId, ctx.actor);
        parentRes = typeof res === 'string' ? safeParse(res) : res;
    }
    return {id: args.id, rename: renameRes, parent: parentRes};
}

export const pageUpdate: McpTool = defineTool({
    // SAFE: routes through navigationService.addUpdateNavigationItem +
    // setParent — no single matching mutation. Drift CI will soft-warn.
    name: 'page.update',
    description: 'Update one or many pages. Single form: pass {id, page?, slug?, parent?}. Bulk form: pass {items: INavigation[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. Cycle + 3-level depth-cap enforced server-side when `parent` is provided. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        properties: {
            id: {type: 'string', minLength: 1},
            page: {type: 'string', minLength: 1},
            slug: {type: 'string'},
            parent: {type: 'string'},
            expectedVersion: {type: 'integer'},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {type: 'string', minLength: 1},
                        page: {type: 'string'},
                        slug: {type: 'string'},
                        parent: {type: 'string'},
                        expectedVersion: {type: 'integer'},
                    },
                },
                description: 'Bulk variant. Each item shaped like the single-item args. Up to 500 items.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'page.update');
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: String(it?.id ?? `idx:${i}`), payload: it}))
        : (typeof args.id === 'string' && args.id ? [{id: args.id, payload: args}] : []);
    if (!items.length) {
        throw new Error('page.update requires `id` or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (_id, payload) => ({
        result: await applyPageUpdate(ctx, payload),
    }));
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

export const pageDelete: McpTool = defineTool({
    // SAFE: routes through cascadeDelete — not a 1:1 GraphQL mutation
    name: 'page.delete',
    description: 'Soft-deletes a page (cascade). Returns the trashGroup so the caller can restore via trash.restore.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'page.delete');
    const navs = await ctx.services.navigationService.getNavigationCollection();
    const row = (navs ?? []).find((n: any) => n.id === args.id);
    if (!row) return {error: 'page-not-found', id: args.id};
    // Use the existing connection-level deleteNavigationItem which goes
    // through the cascade engine and pulls trashGroup back out.
    const conn: any = ctx.services;
    const res = await conn.deleteNavigationItem({
        pageName: row.page,
        _session: {email: ctx.actor},
    });
    return typeof res === 'string' ? safeParse(res) : res;
});

export const pageSetParent: McpTool = defineTool({
    // SAFE: NavigationService.setParent — no top-level GraphQL mutation
    name: 'page.setParent',
    description: 'Move a page under a new parent (or to root with parentId=null). Cycle + 3-level depth-cap enforced server-side.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['pageId'],
        properties: {
            pageId: {type: 'string', minLength: 1},
            parentId: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'page.setParent');
    const parentId = args.parentId === null || args.parentId === undefined || args.parentId === ''
        ? null
        : args.parentId;
    const res = await ctx.services.navigationService.setParent(args.pageId, parentId, ctx.actor);
    return typeof res === 'string' ? safeParse(res) : res;
});

export const pageReorder: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — new service method
    name: 'page.reorder',
    description: 'Set the display order of children under a parent (or root with parentId=null). `orderedIds` is the new sequence.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['orderedIds'],
        properties: {
            parentId: {type: 'string'},
            orderedIds: {type: 'array', items: {type: 'string'}},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'page.reorder');
    const parentId = args.parentId === null || args.parentId === undefined || args.parentId === ''
        ? null
        : args.parentId;
    const res = await ctx.services.navigationService.reorderPages(parentId, args.orderedIds ?? [], ctx.actor);
    return typeof res === 'string' ? safeParse(res) : res;
});

export const PAGE_TOOLS: McpTool[] = [
    pageList, pageGet, pageCreate, pageUpdate, pageDelete, pageSetParent, pageReorder,
    sectionUpdate, sectionDelete,
];
