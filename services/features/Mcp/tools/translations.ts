import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool} from './_shared';

function safeParse(s: unknown): unknown {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

export const i18nListLanguages: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'i18n.listLanguages',
    description: 'Returns the configured languages and their translation maps.',
    scopes: ['read:i18n'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, ctx) => ctx.services.languageService.getLanguages());

/**
 * Bulk upsert by `{symbol, key, value}[]`. Mirrors the CSV import path —
 * groups by language symbol, then merges into `translations` via the
 * existing `addUpdateLanguage` (merge-on-save).
 */
export const i18nUpsertKeys: McpTool = defineTool({
    name: 'i18n.upsertKeys',
    description: 'Bulk-upsert translation keys: [{symbol, key, value}, ...]. Merges with existing translations (matches the CSV import path).',
    scopes: ['write:i18n'],
    idempotent: true,
    gqlMutation: 'addUpdateLanguage',
    inputSchema: {
        type: 'object',
        required: ['entries'],
        properties: {
            entries: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['symbol', 'key', 'value'],
                    properties: {
                        symbol: {type: 'string', minLength: 1},
                        key: {type: 'string', minLength: 1},
                        value: {type: 'string'},
                    },
                },
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const grouped = new Map<string, Record<string, string>>();
    for (const e of (args.entries ?? []) as Array<{symbol: string; key: string; value: string}>) {
        if (!grouped.has(e.symbol)) grouped.set(e.symbol, {});
        grouped.get(e.symbol)![e.key] = e.value;
    }
    const langs = await ctx.services.languageService.getLanguages();
    const results: Array<{symbol: string; version: number; keys: number}> = [];
    for (const [symbol, translations] of grouped.entries()) {
        const existing = (langs ?? []).find((l: any) => l.symbol === symbol);
        const language = existing ?? {symbol, label: symbol, default: false};
        const res = await ctx.services.languageService.addUpdateLanguage({
            language,
            translations: translations as unknown as JSON,
            editedBy: ctx.actor,
        });
        results.push({symbol, version: res?.version ?? 0, keys: Object.keys(translations).length});
    }
    return {upserted: results};
});

export const languageAdd: McpTool = defineTool({
    name: 'language.add',
    description: 'Add (or update) a language. Idempotent on `symbol`. `default: true` demotes any other default.',
    scopes: ['write:i18n'],
    idempotent: true,
    gqlMutation: 'addUpdateLanguage',
    inputSchema: {
        type: 'object',
        required: ['symbol', 'label'],
        properties: {
            symbol: {type: 'string', minLength: 1},
            label: {type: 'string', minLength: 1},
            default: {type: 'boolean'},
            flag: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'language.add');
    const language = {
        symbol: args.symbol,
        label: args.label,
        default: Boolean(args.default),
        ...(args.flag ? {flag: args.flag} : {}),
    } as any;
    const res = await ctx.services.languageService.addUpdateLanguage({
        language,
        translations: {} as unknown as JSON,
        editedBy: ctx.actor,
    });
    return res;
});

export const languageRemove: McpTool = defineTool({
    name: 'language.remove',
    description: 'Delete a language by symbol. Cascade is server-owned.',
    scopes: ['write:i18n'],
    idempotent: true,
    gqlMutation: 'deleteLanguage',
    inputSchema: {
        type: 'object',
        required: ['symbol'],
        properties: {
            symbol: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'language.remove');
    const res = await ctx.services.languageService.deleteLanguage({
        language: {symbol: args.symbol} as any,
        deletedBy: ctx.actor,
    });
    return safeParse(res);
});

export const languageSetDefault: McpTool = defineTool({
    // SAFE: new service method, no matching GraphQL mutation yet
    name: 'language.setDefault',
    description: 'Promote one language to default; demote all others.',
    scopes: ['write:i18n'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['symbol'],
        properties: {
            symbol: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'language.setDefault');
    const res = await ctx.services.languageService.setDefault({
        symbol: args.symbol, editedBy: ctx.actor,
    });
    return safeParse(res);
});

export const translationSet: McpTool = defineTool({
    // SAFE: new service method, no matching GraphQL mutation yet
    name: 'translation.set',
    description: 'Set a single translation key for a language. Mongo + on-disk locale stay in sync.',
    scopes: ['write:i18n'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['symbol', 'key', 'value'],
        properties: {
            symbol: {type: 'string', minLength: 1},
            key: {type: 'string', minLength: 1},
            value: {type: 'string'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const res = await ctx.services.languageService.setKey({
        symbol: args.symbol, key: args.key, value: args.value, editedBy: ctx.actor,
    });
    return res;
});

export const translationDelete: McpTool = defineTool({
    // SAFE: new service method, no matching GraphQL mutation yet
    name: 'translation.delete',
    description: 'Delete a single translation key for a language. Mongo + on-disk locale stay in sync.',
    scopes: ['write:i18n'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['symbol', 'key'],
        properties: {
            symbol: {type: 'string', minLength: 1},
            key: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const res = await ctx.services.languageService.deleteKey({
        symbol: args.symbol, key: args.key, editedBy: ctx.actor,
    });
    return res;
});

export const TRANSLATION_TOOLS: McpTool[] = [
    i18nListLanguages, i18nUpsertKeys,
    languageAdd, languageRemove, languageSetDefault,
    translationSet, translationDelete,
];
