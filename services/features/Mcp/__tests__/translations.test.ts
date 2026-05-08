/**
 * MCP translation tools — coverage for the F8-bulk-introspection chunk.
 *
 *   - `i18n.listLanguages` annotates with coverage / missingKeys when
 *     `includeMissing:true`; `missingOnly:true` filters to incomplete locales.
 *   - `i18n.diff` returns a pairwise diff between two language symbols.
 *   - `i18n.scanCodebase` walks `ui/` for `t('key')` / `i18nKey="key"` and
 *     returns an empty result + `note` when source files are absent.
 *   - `translation.deleteKeys` is a bulk wrapper over `LanguageService.deleteKey`
 *     that isolates per-item failures via the standard bulk envelope.
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as fs from 'fs';
import * as path from 'node:path';
import os from 'os';

import {
    i18nListLanguages, i18nDiff, i18nScanCodebase, translationDeleteKeys,
} from '../tools/translations';
import {_resetIdempotencyForTests} from '@services/infra/idempotency';

const ACTOR = 'mcp:trans';
const decode = (r: any): any => JSON.parse(r.content[0].text);

const baseLangs = (): any[] => ([
    {symbol: 'en', default: true,  translations: {hello: 'Hello', bye: 'Bye'}},
    {symbol: 'lv', default: false, translations: {hello: 'Sveiki'}},
    {symbol: 'ru', default: false, translations: {hello: 'Privet', bye: 'Poka', extra: 'X'}},
]);

const makeCtx = (overrides: any = {}) => ({
    actor: ACTOR,
    audit: undefined,
    services: {
        languageService: {
            getLanguages: vi.fn(async () => baseLangs()),
            deleteKey: vi.fn(async () => 'ok'),
            ...overrides.languageService,
        },
    },
    token: null, tokenSecret: null,
} as any);

beforeEach(() => {
    _resetIdempotencyForTests();
});

describe('i18n.listLanguages — includeMissing', () => {
    it('returns plain languages when includeMissing is omitted', async () => {
        const r = decode(await i18nListLanguages.handler({}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.length).toBe(3);
        expect(r.data[0].coverage).toBeUndefined();
    });

    it('annotates with coverage / missing / extra when includeMissing:true', async () => {
        const r = decode(await i18nListLanguages.handler({includeMissing: true}, makeCtx()));
        expect(r.ok).toBe(true);
        const byKey = Object.fromEntries(r.data.map((d: any) => [d.symbol, d]));
        expect(byKey.en.coverage).toBe(100);
        expect(byKey.lv.coverage).toBe(50);
        expect(byKey.lv.missingKeys).toEqual(['bye']);
        expect(byKey.ru.coverage).toBe(100);
        expect(byKey.ru.extraKeys).toEqual(['extra']);
    });

    it('missingOnly filters to languages below 100% coverage', async () => {
        const r = decode(await i18nListLanguages.handler({includeMissing: true, missingOnly: true}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.map((d: any) => d.symbol)).toEqual(['lv']);
    });
});

describe('i18n.diff', () => {
    it('reports onlyInA / onlyInB / differingValues', async () => {
        const r = decode(await i18nDiff.handler({symbolA: 'en', symbolB: 'lv'}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.symbolA).toBe('en');
        expect(r.data.symbolB).toBe('lv');
        expect(r.data.onlyInA).toEqual(['bye']);
        expect(r.data.onlyInB).toEqual([]);
        // hello differs ('Hello' vs 'Sveiki')
        expect(r.data.differingValues).toEqual([{key: 'hello', a: 'Hello', b: 'Sveiki'}]);
    });

    it('returns language-not-found error when a symbol is missing', async () => {
        const r = decode(await i18nDiff.handler({symbolA: 'en', symbolB: 'zz'}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.error).toBe('language-not-found');
        expect(r.data.symbol).toBe('zz');
    });
});

describe('i18n.scanCodebase', () => {
    it('returns empty + note when none of the requested paths exist', async () => {
        const r = decode(await i18nScanCodebase.handler(
            {paths: ['__definitely_not_a_real_dir__']},
            makeCtx(),
        ));
        expect(r.ok).toBe(true);
        expect(r.data.keys).toEqual([]);
        expect(r.data.byFile).toEqual([]);
        expect(typeof r.data.note).toBe('string');
    });

    it('extracts t(...) and i18nKey="..." matches from source files', async () => {
        const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mcp-i18n-scan-'));
        const file = path.join(tmp, 'sample.tsx');
        await fs.promises.writeFile(file, [
            "const a = t('hello.world');",
            "const b = t(\"foo.bar\");",
            '<Trans i18nKey="page.title">Title</Trans>',
            "// noise: t('not-a-key)",
        ].join('\n'), 'utf8');
        const r = decode(await i18nScanCodebase.handler({paths: [tmp]}, makeCtx()));
        expect(r.ok).toBe(true);
        expect(r.data.keys.sort()).toEqual(['foo.bar', 'hello.world', 'page.title']);
        expect(r.data.byFile.length).toBe(1);
        await fs.promises.rm(tmp, {recursive: true, force: true});
    });
});

describe('translation.deleteKeys — bulk', () => {
    it('runs deleteKey once per item and aggregates the bulk envelope', async () => {
        const ctx = makeCtx();
        const r = decode(await translationDeleteKeys.handler({
            items: [
                {symbol: 'en', key: 'a'},
                {symbol: 'lv', key: 'b'},
            ],
        }, ctx));
        expect(r.ok).toBe(true);
        expect(r.data.succeededCount).toBe(2);
        expect(r.data.failedCount).toBe(0);
        expect(ctx.services.languageService.deleteKey).toHaveBeenCalledTimes(2);
    });

    it('isolates per-item failures without aborting the batch', async () => {
        const deleteKey = vi.fn()
            .mockResolvedValueOnce('ok')
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce('ok');
        const ctx = makeCtx({languageService: {deleteKey}});
        const r = decode(await translationDeleteKeys.handler({
            items: [
                {symbol: 'en', key: 'a'},
                {symbol: 'en', key: 'b'},
                {symbol: 'lv', key: 'a'},
            ],
        }, ctx));
        expect(r.ok).toBe(true);
        expect(r.data.ok).toBe(false);
        expect(r.data.succeededCount).toBe(2);
        expect(r.data.failedCount).toBe(1);
        expect(r.data.failed[0].id).toBe('en:b');
        expect(r.data.failed[0].error).toMatch(/boom/);
    });
});
