import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';

const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});
const safeParse = (s: string): unknown => { try { return JSON.parse(s); } catch { return {raw: s}; } };

export const themeList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'theme.list',
    description: 'Returns every theme (presets + customs) and their tokens.',
    scopes: ['read:themes'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => ctx.services.themeService.getThemes());

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

export const THEME_TOOLS: McpTool[] = [themeList, themeUpdate, themeSetActive];
