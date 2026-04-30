import {McpTool} from '../types';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});
const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});

const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return {raw: s}; } };

export const themeList: McpTool = {
    name: 'theme.list',
    description: 'Returns every theme (presets + customs) and their tokens.',
    scopes: ['read:themes'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, ctx) => {
        const themes = await ctx.services.themeService.getThemes();
        return ok(themes);
    },
};

export const themeUpdate: McpTool = {
    name: 'theme.update',
    description: 'Saves a theme (insert when `theme.id` is omitted, update otherwise).',
    scopes: ['write:themes'],
    inputSchema: {
        type: 'object',
        required: ['theme'],
        properties: {
            theme: {type: 'object', properties: {}},
            expectedVersion: {type: 'integer'},
        },
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.saveTheme({
            theme: args.theme,
            expectedVersion: args.expectedVersion ?? null,
            _session: sessionFor(ctx.actor),
        });
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const themeSetActive: McpTool = {
    name: 'theme.setActive',
    description: 'Switches the active theme (writes `siteSettings.activeThemeId`).',
    scopes: ['write:themes'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {id: {type: 'string', minLength: 1}},
    },
    handler: async (args, ctx) => {
        const res = await ctx.services.setActiveTheme({id: args.id, _session: sessionFor(ctx.actor)});
        return ok(typeof res === 'string' ? safeParse(res) : res);
    },
};

export const THEME_TOOLS: McpTool[] = [themeList, themeUpdate, themeSetActive];
