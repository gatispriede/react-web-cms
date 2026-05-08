import {describe, it, expect} from 'vitest';
import {diffLanguagesAgainstDefault, diffPair} from './TranslationDiffService';

describe('diffLanguagesAgainstDefault', () => {
    it('returns 100 % coverage when every default key is present in the secondary lang', () => {
        const result = diffLanguagesAgainstDefault([
            {symbol: 'en', default: true, translations: {hello: 'Hello', bye: 'Bye'}},
            {symbol: 'lv', translations: {hello: 'Sveiki', bye: 'Atā'}},
        ]);
        const lv = result.find(r => r.symbol === 'lv')!;
        expect(lv.coverage).toBe(100);
        expect(lv.missingKeys).toEqual([]);
        expect(lv.extraKeys).toEqual([]);
    });

    it('flags missing keys and lowers coverage proportionally', () => {
        const result = diffLanguagesAgainstDefault([
            {symbol: 'en', default: true, translations: {a: 'A', b: 'B', c: 'C', d: 'D'}},
            {symbol: 'lv', translations: {a: 'Lv-A', b: 'Lv-B'}},
        ]);
        const lv = result.find(r => r.symbol === 'lv')!;
        expect(lv.coverage).toBe(50);
        expect(lv.missingKeys).toEqual(['c', 'd']);
    });

    it('treats empty-string values as missing', () => {
        const result = diffLanguagesAgainstDefault([
            {symbol: 'en', default: true, translations: {a: 'A', b: 'B'}},
            {symbol: 'lv', translations: {a: 'Lv-A', b: ''}},
        ]);
        const lv = result.find(r => r.symbol === 'lv')!;
        expect(lv.coverage).toBe(50);
        expect(lv.missingKeys).toEqual(['b']);
    });

    it('marks the default language with coverage 100 and empty diffs even when its map is empty', () => {
        const result = diffLanguagesAgainstDefault([
            {symbol: 'en', default: true, translations: {}},
            {symbol: 'lv', translations: {a: 'Lv-A'}},
        ]);
        const en = result.find(r => r.symbol === 'en')!;
        expect(en.isDefault).toBe(true);
        expect(en.coverage).toBe(100);
        const lv = result.find(r => r.symbol === 'lv')!;
        expect(lv.coverage).toBe(100); // no default keys → trivially complete
        expect(lv.extraKeys).toEqual(['a']);
    });

    it('flags extra keys present in the lang but not the default', () => {
        const result = diffLanguagesAgainstDefault([
            {symbol: 'en', default: true, translations: {a: 'A'}},
            {symbol: 'lv', translations: {a: 'Lv-A', legacy: 'leftover'}},
        ]);
        const lv = result.find(r => r.symbol === 'lv')!;
        expect(lv.extraKeys).toEqual(['legacy']);
    });

    it('handles multiple non-default languages independently', () => {
        const result = diffLanguagesAgainstDefault([
            {symbol: 'en', default: true, translations: {a: 'A', b: 'B'}},
            {symbol: 'lv', translations: {a: 'Lv-A', b: 'Lv-B'}},
            {symbol: 'ru', translations: {a: 'Ru-A'}},
        ]);
        expect(result.find(r => r.symbol === 'lv')!.coverage).toBe(100);
        expect(result.find(r => r.symbol === 'ru')!.coverage).toBe(50);
        expect(result.find(r => r.symbol === 'ru')!.missingKeys).toEqual(['b']);
    });

    it('falls back to first language when no row is flagged default', () => {
        const result = diffLanguagesAgainstDefault([
            {symbol: 'en', translations: {a: 'A'}},
            {symbol: 'lv', translations: {a: 'Lv-A'}},
        ]);
        expect(result[0]!.isDefault).toBe(true);
        expect(result[0]!.coverage).toBe(100);
    });
});

describe('diffPair', () => {
    it('reports keys exclusive to each side and value disagreements', () => {
        const result = diffPair(
            {translations: {a: 'A1', b: 'B1', shared: 'same'}},
            {translations: {a: 'A2', c: 'C2', shared: 'same'}},
        );
        expect(result.onlyInA).toEqual(['b']);
        expect(result.onlyInB).toEqual(['c']);
        expect(result.differingValues).toEqual([{key: 'a', a: 'A1', b: 'A2'}]);
    });

    it('returns empty arrays for identical maps', () => {
        const result = diffPair(
            {translations: {a: 'A', b: 'B'}},
            {translations: {a: 'A', b: 'B'}},
        );
        expect(result.onlyInA).toEqual([]);
        expect(result.onlyInB).toEqual([]);
        expect(result.differingValues).toEqual([]);
    });
});
