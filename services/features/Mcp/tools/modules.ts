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

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

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

export const moduleListTypes: McpTool = {
    name: 'module.listTypes',
    description: 'Enumerates the registered module item types (EItemType) and the shared style enum (EStyle).',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
    handler: async () => {
        return ok({
            itemTypes: Object.entries(EItemType).map(([k, v]) => ({key: k, value: v})),
            styles: Object.entries(EStyle).map(([k, v]) => ({key: k, value: v})),
        });
    },
};

export const moduleAdd: McpTool = {
    name: 'module.add',
    description: 'Append a module to a section.content array (or insert at index `at`). Persists through the same pipeline as section.update.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['sectionId', 'module'],
        properties: {
            sectionId: {type: 'string', minLength: 1},
            module: moduleSchema,
            at: {type: 'integer', minimum: 0},
        },
    },
    handler: async (args, ctx) => {
        await enforceModeForTool(ctx.actor, 'module.add');
        const sec = await loadSection(ctx, args.sectionId);
        if (!sec) return ok({ok: false, error: 'section not found'});
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
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const moduleUpdate: McpTool = {
    name: 'module.update',
    description: 'Replace section.content[at] with the given module spec.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['sectionId', 'module', 'at'],
        properties: {
            sectionId: {type: 'string', minLength: 1},
            module: moduleSchema,
            at: {type: 'integer', minimum: 0},
        },
    },
    handler: async (args, ctx) => {
        await enforceModeForTool(ctx.actor, 'module.update');
        const sec = await loadSection(ctx, args.sectionId);
        if (!sec) return ok({ok: false, error: 'section not found'});
        const content = Array.isArray(sec.content) ? sec.content.slice() : [];
        if (args.at < 0 || args.at >= content.length) {
            return ok({ok: false, error: `index ${args.at} out of range (0..${content.length - 1})`});
        }
        content[args.at] = moduleFromArg(args.module);
        const next = {...sec, content};
        const res = await ctx.services.addUpdateSectionItem({
            section: next,
            expectedVersion: typeof sec.version === 'number' ? sec.version : null,
            _session: sessionFor(ctx.actor),
        });
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const moduleRemove: McpTool = {
    name: 'module.remove',
    description: 'Remove section.content[at] from the section.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['sectionId', 'at'],
        properties: {
            sectionId: {type: 'string', minLength: 1},
            at: {type: 'integer', minimum: 0},
        },
    },
    handler: async (args, ctx) => {
        await enforceModeForTool(ctx.actor, 'module.remove');
        const sec = await loadSection(ctx, args.sectionId);
        if (!sec) return ok({ok: false, error: 'section not found'});
        const content = Array.isArray(sec.content) ? sec.content.slice() : [];
        if (args.at < 0 || args.at >= content.length) {
            return ok({ok: false, error: `index ${args.at} out of range (0..${content.length - 1})`});
        }
        content.splice(args.at, 1);
        const next = {...sec, content};
        const res = await ctx.services.addUpdateSectionItem({
            section: next,
            expectedVersion: typeof sec.version === 'number' ? sec.version : null,
            _session: sessionFor(ctx.actor),
        });
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

function safeParse(s: string): unknown {
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

export const MODULE_TOOLS: McpTool[] = [moduleListTypes, moduleAdd, moduleUpdate, moduleRemove];
