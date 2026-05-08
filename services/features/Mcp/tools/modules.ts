/**
 * Module-level MCP tools — manipulate the `content[]` array of a Section
 * by appending / replacing / removing one module at a time. The grain
 * matches what an AI client actually wants ("add an InquiryForm to the
 * Kontakti page"); doing the same via `section.update` requires the
 * caller to read, splice, and write the whole content array, which a
 * model frequently gets wrong (drops siblings, drops version).
 *
 * Read flow: `navigationService.getSections([sectionId])` → splice the
 * `content` array → write back through the same `addUpdateSectionItem`
 * pipeline `section.update` uses (DOMPurify + validateSectionInput +
 * audit row + optimistic version).
 */
import {EItemType} from '@enums/EItemType';
import {EStyle} from '@enums/EStyle';
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool, runBatch} from './_shared';
import {scanModuleUsage} from '@services/features/Modules/ModuleUsageService';

const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});

interface ModuleSpec {
    type: string;
    style?: string;
    content?: string;
    action?: string;
    actionStyle?: string;
    actionType?: string;
    actionContent?: string;
    animation?: string;
}

function moduleFromArg(m: ModuleSpec): Record<string, unknown> {
    // Mirror the shape the admin module editors emit: type/style/content
    // plus the action quartet defaults the validators expect.
    return {
        type: m.type,
        style: m.style ?? 'default',
        content: m.content ?? '{}',
        action: m.action ?? 'none',
        actionStyle: m.actionStyle ?? 'default',
        actionType: m.actionType ?? 'TEXT',
        actionContent: m.actionContent ?? '{}',
        animation: m.animation ?? 'none',
    };
}

async function loadSection(ctx: any, sectionId: string): Promise<any> {
    const list = await ctx.services.navigationService.getSections([sectionId]);
    return Array.isArray(list) ? list.find((s: any) => s?.id === sectionId) : undefined;
}

const moduleSchema = {
    type: 'object' as const,
    required: ['type'],
    properties: {
        type: {type: 'string' as const, minLength: 1, description: 'EItemType value, e.g. INQUIRY_FORM'},
        style: {type: 'string' as const},
        content: {type: 'string' as const, description: 'JSON string the module ContentManager understands.'},
        action: {type: 'string' as const},
        actionStyle: {type: 'string' as const},
        actionType: {type: 'string' as const},
        actionContent: {type: 'string' as const},
        animation: {type: 'string' as const},
    },
};

export const moduleListTypes: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'module.listTypes',
    description: 'Enumerates the registered module item types (EItemType) and the shared style enum (EStyle). Set `includeUsage:true` to also report per-type `usageCount` and the distinct `pages[]` each type appears on.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            includeUsage: {type: 'boolean', description: 'When true, walks pages × sections and adds `usageCount` + `pages[]` to each itemType row.'},
        },
    },
}, async (args, ctx) => {
    const itemTypes = Object.entries(EItemType).map(([k, v]) => ({key: k, value: v as string}));
    const styles = Object.entries(EStyle).map(([k, v]) => ({key: k, value: v}));
    if (!args.includeUsage) return {itemTypes, styles};
    const pages = (await ctx.services.navigationService.getNavigationCollection?.()) ?? [];
    const idToPage = new Map<string, string>();
    const allIds: string[] = [];
    for (const p of pages as Array<{page: string; sections?: string[]}>) {
        for (const id of p.sections ?? []) {
            idToPage.set(id, p.page);
            allIds.push(id);
        }
    }
    const docs = allIds.length
        ? (await ctx.services.navigationService.getSections?.(allIds)) ?? []
        : [];
    const sections = (docs as Array<{id?: string; page?: string; content?: Array<{type?: string}>}>).map(d => ({
        page: d.page ?? (d.id ? idToPage.get(d.id) : undefined),
        content: d.content,
    }));
    const usage = scanModuleUsage({
        types: itemTypes.map(t => t.value),
        sections,
    });
    const byType = new Map(usage.map(u => [u.type, u]));
    return {
        itemTypes: itemTypes.map(t => {
            const u = byType.get(t.value);
            return {...t, usageCount: u?.usageCount ?? 0, pages: u?.pages ?? []};
        }),
        styles,
    };
});

async function moduleAddOnce(ctx: any, args: {sectionId: string; module: ModuleSpec; at?: number}): Promise<any> {
    const sec = await loadSection(ctx, args.sectionId);
    if (!sec) return {ok: false, error: 'section not found'};
    const content = Array.isArray(sec.content) ? sec.content.slice() : [];
    const item = moduleFromArg(args.module);
    const at = typeof args.at === 'number' ? Math.max(0, Math.min(args.at, content.length)) : content.length;
    content.splice(at, 0, item);
    const next = {...sec, content};
    const res = await ctx.services.addUpdateSectionItem({
        section: next,
        expectedVersion: typeof sec.version === 'number' ? sec.version : null,
        _session: sessionFor(ctx.actor),
    });
    return typeof res === 'string' ? safeParse(res) : res;
}

async function moduleUpdateOnce(ctx: any, args: {sectionId: string; module: ModuleSpec; at: number}): Promise<any> {
    const sec = await loadSection(ctx, args.sectionId);
    if (!sec) return {ok: false, error: 'section not found'};
    const content = Array.isArray(sec.content) ? sec.content.slice() : [];
    if (args.at < 0 || args.at >= content.length) {
        return {ok: false, error: `index ${args.at} out of range (0..${content.length - 1})`};
    }
    content[args.at] = moduleFromArg(args.module);
    const next = {...sec, content};
    const res = await ctx.services.addUpdateSectionItem({
        section: next,
        expectedVersion: typeof sec.version === 'number' ? sec.version : null,
        _session: sessionFor(ctx.actor),
    });
    return typeof res === 'string' ? safeParse(res) : res;
}

async function moduleRemoveOnce(ctx: any, args: {sectionId: string; at: number}): Promise<any> {
    const sec = await loadSection(ctx, args.sectionId);
    if (!sec) return {ok: false, error: 'section not found'};
    const content = Array.isArray(sec.content) ? sec.content.slice() : [];
    if (args.at < 0 || args.at >= content.length) {
        return {ok: false, error: `index ${args.at} out of range (0..${content.length - 1})`};
    }
    content.splice(args.at, 1);
    const next = {...sec, content};
    const res = await ctx.services.addUpdateSectionItem({
        section: next,
        expectedVersion: typeof sec.version === 'number' ? sec.version : null,
        _session: sessionFor(ctx.actor),
    });
    return typeof res === 'string' ? safeParse(res) : res;
}

export const moduleAdd: McpTool = defineTool({
    name: 'module.add',
    description: 'Append one or many modules to section.content arrays. Single form: pass {sectionId, module, at?}. Bulk form: pass {items: {sectionId, module, at?}[]}. Bulk returns per-item failures via `data.failed[]`. Persists through the same pipeline as section.update. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    auditScope: 'modules',
    gqlMutation: 'addUpdateSectionItem',
    inputSchema: {
        type: 'object',
        properties: {
            sectionId: {type: 'string', minLength: 1},
            module: moduleSchema,
            at: {type: 'integer', minimum: 0},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        sectionId: {type: 'string', minLength: 1},
                        module: moduleSchema,
                        at: {type: 'integer', minimum: 0},
                    },
                },
                description: 'Bulk variant. Up to 500 items. Mutually exclusive with the single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'module.add');
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: String(it?.sectionId ?? `idx:${i}`) + ':' + i, payload: it}))
        : (typeof args.sectionId === 'string' && args.module
            ? [{id: args.sectionId, payload: {sectionId: args.sectionId, module: args.module, at: args.at}}]
            : []);
    if (!items.length) {
        throw new Error('module.add requires `sectionId`+`module` or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (_id, payload) => ({
        result: await moduleAddOnce(ctx, payload),
    }));
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

export const moduleUpdate: McpTool = defineTool({
    name: 'module.update',
    description: 'Replace section.content[at] with the given module spec. Single form: pass {sectionId, module, at}. Bulk form: pass {items: {sectionId, module, at}[]}. Bulk returns per-item failures via `data.failed[]`. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    auditScope: 'modules',
    gqlMutation: 'addUpdateSectionItem',
    inputSchema: {
        type: 'object',
        properties: {
            sectionId: {type: 'string', minLength: 1},
            module: moduleSchema,
            at: {type: 'integer', minimum: 0},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        sectionId: {type: 'string', minLength: 1},
                        module: moduleSchema,
                        at: {type: 'integer', minimum: 0},
                    },
                },
                description: 'Bulk variant. Up to 500 items. Mutually exclusive with the single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'module.update');
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: `${it?.sectionId ?? 'idx'}:${it?.at ?? i}`, payload: it}))
        : (typeof args.sectionId === 'string' && args.module && typeof args.at === 'number'
            ? [{id: `${args.sectionId}:${args.at}`, payload: {sectionId: args.sectionId, module: args.module, at: args.at}}]
            : []);
    if (!items.length) {
        throw new Error('module.update requires `sectionId`+`module`+`at` or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (_id, payload) => ({
        result: await moduleUpdateOnce(ctx, payload),
    }));
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

export const moduleRemove: McpTool = defineTool({
    name: 'module.remove',
    description: 'Remove section.content[at] from the section. Single form: pass {sectionId, at}. Bulk form: pass {items: {sectionId, at}[]}. Bulk returns per-item failures via `data.failed[]`. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    auditScope: 'modules',
    gqlMutation: 'addUpdateSectionItem',
    inputSchema: {
        type: 'object',
        properties: {
            sectionId: {type: 'string', minLength: 1},
            at: {type: 'integer', minimum: 0},
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        sectionId: {type: 'string', minLength: 1},
                        at: {type: 'integer', minimum: 0},
                    },
                },
                description: 'Bulk variant. Up to 500 items. Mutually exclusive with the single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'module.remove');
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: `${it?.sectionId ?? 'idx'}:${it?.at ?? i}`, payload: it}))
        : (typeof args.sectionId === 'string' && typeof args.at === 'number'
            ? [{id: `${args.sectionId}:${args.at}`, payload: {sectionId: args.sectionId, at: args.at}}]
            : []);
    if (!items.length) {
        throw new Error('module.remove requires `sectionId`+`at` or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (_id, payload) => ({
        result: await moduleRemoveOnce(ctx, payload),
    }));
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

function safeParse(s: string): unknown {
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

export const MODULE_TOOLS: McpTool[] = [moduleListTypes, moduleAdd, moduleUpdate, moduleRemove];
