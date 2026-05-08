import fs from 'fs';
import path from 'node:path';
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {defineTool, runBatch} from './_shared';
import {diffLanguagesAgainstDefault, diffPair} from '@services/features/Languages/TranslationDiffService';

function safeParse(s: unknown): unknown {
    if (typeof s !== 'string') return s;
    try { return JSON.parse(s); } catch { return {raw: s}; }
}

export const i18nListLanguages: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'i18n.listLanguages',
    description: 'Returns the configured languages and their translation maps. Set `includeMissing:true` to also annotate each language with `coverage`, `missingKeys[]` and `extraKeys[]` (computed against the default-language baseline). Pair with `missingOnly:true` to filter to languages that are missing any keys.',
    scopes: ['read:i18n'],
    inputSchema: {
        type: 'object',
        properties: {
            includeMissing: {type: 'boolean', description: 'When true, each language is annotated with `coverage` (0-100), `missingKeys[]` (in default but missing here), and `extraKeys[]` (here but not in default).'},
            missingOnly: {type: 'boolean', description: 'When true (and `includeMissing` is also true), filters out languages with `coverage === 100`. No-op without `includeMissing`.'},
        },
    },
}, async (args, ctx) => {
    const langs = await ctx.services.languageService.getLanguages();
    if (!args.includeMissing) return langs;
    const list = (langs ?? []) as Array<{symbol: string; default?: boolean; translations?: Record<string, string>}>;
    const diffs = diffLanguagesAgainstDefault(list);
    const byKey = new Map(diffs.map(d => [d.symbol, d]));
    const annotated = list.map(l => {
        const d = byKey.get(l.symbol);
        return {
            ...l,
            coverage: d?.coverage ?? 100,
            missingKeys: d?.missingKeys ?? [],
            extraKeys: d?.extraKeys ?? [],
        };
    });
    return args.missingOnly
        ? annotated.filter(r => r.coverage < 100)
        : annotated;
});

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

export const i18nDiff: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — pure read + service join
    name: 'i18n.diff',
    description: 'Pairwise diff of two languages by symbol. Returns `{onlyInA, onlyInB, differingValues}` for the keys that diverge between the two locales.',
    scopes: ['read:i18n'],
    inputSchema: {
        type: 'object',
        required: ['symbolA', 'symbolB'],
        properties: {
            symbolA: {type: 'string', minLength: 1},
            symbolB: {type: 'string', minLength: 1},
        },
    },
}, async (args, ctx) => {
    const langs = (await ctx.services.languageService.getLanguages()) ?? [];
    const a = (langs as any[]).find(l => l?.symbol === args.symbolA);
    const b = (langs as any[]).find(l => l?.symbol === args.symbolB);
    if (!a) return {error: 'language-not-found', symbol: args.symbolA};
    if (!b) return {error: 'language-not-found', symbol: args.symbolB};
    const diff = diffPair({translations: a.translations}, {translations: b.translations});
    return {symbolA: args.symbolA, symbolB: args.symbolB, ...diff};
});

const T_CALL_RE = /\bt\(['"]([^'"]+)['"]/g;
const TRANS_KEY_RE = /i18nKey=['"]([^'"]+)['"]/g;
const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git']);

async function walkForTranslationKeys(
    root: string,
    maxDepth: number,
): Promise<Array<{file: string; keys: string[]}>> {
    const out: Array<{file: string; keys: string[]}> = [];
    async function walk(dir: string, depth: number): Promise<void> {
        if (depth > maxDepth) return;
        let entries: Array<{name: string; isDir: boolean; isFile: boolean}>;
        try {
            const dirents = await fs.promises.readdir(dir, {withFileTypes: true});
            entries = dirents.map(d => ({name: d.name, isDir: d.isDirectory(), isFile: d.isFile()}));
        } catch {
            return;
        }
        for (const e of entries) {
            if (SKIP_DIRS.has(e.name)) continue;
            const full = path.join(dir, e.name);
            if (e.isDir) {
                await walk(full, depth + 1);
            } else if (e.isFile && SCAN_EXTS.has(path.extname(e.name))) {
                let body: string;
                try { body = await fs.promises.readFile(full, 'utf8'); } catch { continue; }
                const found = new Set<string>();
                let m: RegExpExecArray | null;
                T_CALL_RE.lastIndex = 0;
                while ((m = T_CALL_RE.exec(body)) !== null) found.add(m[1]);
                TRANS_KEY_RE.lastIndex = 0;
                while ((m = TRANS_KEY_RE.exec(body)) !== null) found.add(m[1]);
                if (found.size > 0) {
                    out.push({file: full, keys: [...found].sort()});
                }
            }
        }
    }
    await walk(root, 0);
    return out;
}

export const i18nScanCodebase: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — read-only filesystem scan
    name: 'i18n.scanCodebase',
    description: 'Walks the UI source tree (default `ui/`) for `t(\'key\')` and `<Trans i18nKey="key">` usages. Returns `{keys[], byFile[]}`. Production builds may not ship source files; in that case returns an empty result with a `note` field.',
    scopes: ['read:i18n'],
    inputSchema: {
        type: 'object',
        properties: {
            paths: {type: 'array', items: {type: 'string'}, description: 'Optional glob roots to scan (default: ["ui/"]).'},
        },
    },
}, async (args) => {
    const roots = Array.isArray(args.paths) && args.paths.length > 0
        ? args.paths.filter((p: unknown): p is string => typeof p === 'string' && p.length > 0)
        : ['ui'];
    const cwd = process.cwd();
    const allByFile: Array<{file: string; keys: string[]}> = [];
    let scannedAny = false;
    for (const root of roots) {
        const abs = path.isAbsolute(root) ? root : path.join(cwd, root);
        if (!fs.existsSync(abs)) continue;
        scannedAny = true;
        const found = await walkForTranslationKeys(abs, 6);
        for (const f of found) allByFile.push(f);
    }
    if (!scannedAny) {
        return {keys: [], byFile: [], note: `none of the requested paths exist under ${cwd}; source files are not part of the runtime image`};
    }
    const keySet = new Set<string>();
    for (const f of allByFile) for (const k of f.keys) keySet.add(k);
    return {keys: [...keySet].sort(), byFile: allByFile};
});

export const translationDeleteKeys: McpTool = defineTool({
    // SAFE: bulk wrapper over LanguageService.deleteKey — no matching mutation
    name: 'translation.deleteKeys',
    description: 'Bulk-delete translation keys: [{symbol, key}, ...]. Mirrors `translation.delete` per item; returns the standard bulk envelope with per-item failures isolated. Reference: image.delete { ids[] }.',
    scopes: ['write:i18n'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['items'],
        properties: {
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['symbol', 'key'],
                    properties: {
                        symbol: {type: 'string', minLength: 1},
                        key: {type: 'string', minLength: 1},
                    },
                },
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'translation.deleteKeys');
    const inputs = (args.items ?? []) as Array<{symbol: string; key: string}>;
    const items = inputs.map(it => ({id: `${it.symbol}:${it.key}`, payload: it}));
    if (!items.length) {
        throw new Error('translation.deleteKeys requires non-empty `items[]`');
    }
    return runBatch(items, async (_id, payload) => {
        const res = await ctx.services.languageService.deleteKey({
            symbol: payload!.symbol,
            key: payload!.key,
            editedBy: ctx.actor,
        });
        return {result: res};
    });
});

export const TRANSLATION_TOOLS: McpTool[] = [
    i18nListLanguages, i18nUpsertKeys,
    languageAdd, languageRemove, languageSetDefault,
    translationSet, translationDelete, translationDeleteKeys,
    i18nDiff, i18nScanCodebase,
];
