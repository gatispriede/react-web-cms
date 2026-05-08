import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';
import {scanThemeUsage} from '@services/features/Themes/ThemeUsageService';

const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});
const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return {raw: s}; } };

export const themeList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'theme.list',
    description: 'Returns every theme (presets + customs) and their tokens. Set `includeUsage:true` to also annotate each row with `isActive` and `inPublishHistory`.',
    scopes: ['read:themes'],
    inputSchema: {
        type: 'object',
        properties: {
            includeUsage: {type: 'boolean', description: 'When true, each theme is annotated with `isActive` (matches `themeService.getActive().id`) and `inPublishHistory` (currently always false; reserved for a future snapshot.themeId schema bump).'},
        },
    },
}, async (args, ctx) => {
    const themes = await ctx.services.themeService.getThemes();
    if (!args.includeUsage) return themes;
    const list = (themes ?? []) as Array<{id: string; name: string}>;
    const active = await ctx.services.themeService.getActive?.();
    const usage = scanThemeUsage({
        themes: list.map(t => ({id: t.id, name: t.name})),
        activeId: active?.id ?? null,
        publishHistoryThemeIds: [],
    });
    const byId = new Map(usage.map(u => [u.id, u]));
    return list.map(t => {
        const u = byId.get(t.id);
        return {...t, isActive: u?.isActive ?? false, inPublishHistory: u?.inPublishHistory ?? false};
    });
});

export const themeUpdate: McpTool = defineTool({
    name: 'theme.update',
    description: 'Saves a theme (insert when `theme.id` is omitted, update otherwise).',
    scopes: ['write:themes'],
    idempotent: true,
    gqlMutation: 'saveTheme',
    inputSchema: {
        type: 'object',
        required: ['theme'],
        properties: {
            theme: {type: 'object', properties: {}},
            expectedVersion: {type: 'integer'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'theme.update');
    const res = await ctx.services.saveTheme({
        theme: args.theme,
        expectedVersion: args.expectedVersion ?? null,
        _session: sessionFor(ctx.actor),
    });
    return typeof res === 'string' ? safeParse(res) : res;
});

export const themeSetActive: McpTool = defineTool({
    name: 'theme.setActive',
    description: 'Switches the active theme (writes `siteSettings.activeThemeId`).',
    scopes: ['write:themes'],
    idempotent: true,
    gqlMutation: 'setActiveTheme',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'theme.setActive');
    const res = await ctx.services.setActiveTheme({id: args.id, _session: sessionFor(ctx.actor)});
    return typeof res === 'string' ? safeParse(res) : res;
});

export const themeCreate: McpTool = defineTool({
    name: 'theme.create',
    description: 'Create a new (custom) theme. Sugar over theme.update with no `id`.',
    scopes: ['write:themes'],
    idempotent: true,
    gqlMutation: 'saveTheme',
    inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
            name: {type: 'string', minLength: 1},
            tokens: {type: 'object', properties: {}},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'theme.create');
    const res = await ctx.services.saveTheme({
        theme: {name: args.name, tokens: args.tokens ?? {}, custom: true},
        expectedVersion: null,
        _session: sessionFor(ctx.actor),
    });
    return typeof res === 'string' ? safeParse(res) : res;
});

export const themeDelete: McpTool = defineTool({
    name: 'theme.delete',
    description: 'Delete a custom theme. Refuses to delete a preset; if the active theme is deleted, falls back to another row.',
    scopes: ['write:themes'],
    idempotent: true,
    gqlMutation: 'deleteTheme',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'theme.delete');
    const res = await ctx.services.deleteTheme({id: args.id, _session: sessionFor(ctx.actor)});
    return typeof res === 'string' ? safeParse(res) : res;
});

export const themeResetPreset: McpTool = defineTool({
    name: 'theme.resetPreset',
    description: 'Reset a JSON-backed preset row to the on-disk preset values.',
    scopes: ['write:themes'],
    idempotent: true,
    gqlMutation: 'resetPreset',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'theme.resetPreset');
    const res = await ctx.services.resetPreset({id: args.id, _session: sessionFor(ctx.actor)});
    return typeof res === 'string' ? safeParse(res) : res;
});

export const THEME_TOOLS: McpTool[] = [
    themeList, themeUpdate, themeSetActive,
    themeCreate, themeDelete, themeResetPreset,
];
