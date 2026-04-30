import {McpTool} from '../types';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});

export const i18nListLanguages: McpTool = {
    name: 'i18n.listLanguages',
    description: 'Returns the configured languages and their translation maps.',
    scopes: ['read:i18n'],
    inputSchema: {type: 'object', properties: {}},
    handler: async (_args, ctx) => {
        const langs = await ctx.services.languageService.getLanguages();
        return ok(langs);
    },
};

/**
 * Bulk upsert by `{symbol, key, value}[]`. Mirrors the CSV import path —
 * groups by language symbol, then merges into `translations` via the
 * existing `addUpdateLanguage` (merge-on-save).
 */
export const i18nUpsertKeys: McpTool = {
    name: 'i18n.upsertKeys',
    description: 'Bulk-upsert translation keys: [{symbol, key, value}, ...]. Merges with existing translations (matches the CSV import path).',
    scopes: ['write:i18n'],
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
        },
    },
    handler: async (args, ctx) => {
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
        return ok({upserted: results});
    },
};

export const TRANSLATION_TOOLS: McpTool[] = [i18nListLanguages, i18nUpsertKeys];
