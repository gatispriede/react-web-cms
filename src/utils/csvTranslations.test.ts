import {describe, it, expect} from 'vitest';
import {parseCsv, translationsFromCsv} from './csvTranslations';

describe('parseCsv', () => {
    it('parses a simple 2-column body', () => {
        const {header, rows} = parseCsv('key,en\nHome,Home\nAbout,About\n');
        expect(header).toEqual(['key', 'en']);
        expect(rows).toEqual([['Home', 'Home'], ['About', 'About']]);
    });

    it('handles quoted fields with commas, newlines, and escaped quotes', () => {
        const csv = 'key,en\n"k1","a, with comma"\n"k2","line1\nline2"\n"k3","has ""quote"""\n';
        const {rows} = parseCsv(csv);
        expect(rows[0]).toEqual(['k1', 'a, with comma']);
        expect(rows[1]).toEqual(['k2', 'line1\nline2']);
        expect(rows[2]).toEqual(['k3', 'has "quote"']);
    });

    it('accepts CRLF line endings', () => {
        const {rows} = parseCsv('key,en\r\nA,1\r\nB,2\r\n');
        expect(rows).toEqual([['A', '1'], ['B', '2']]);
    });

    it('skips fully-empty rows', () => {
        const {rows} = parseCsv('key,en\nA,1\n\n,\nB,2\n');
        expect(rows).toEqual([['A', '1'], ['B', '2']]);
    });
});

describe('translationsFromCsv', () => {
    const parsed = parseCsv('key,source,en,lv\nHome,Home,Home EN,Sākums\nAbout,About,About EN,\nEmpty,,,""\n');

    it('builds a key→value map for the chosen locale, skipping blanks', () => {
        const en = translationsFromCsv(parsed, 'en');
        expect(en).toEqual({Home: 'Home EN', About: 'About EN'});

        const lv = translationsFromCsv(parsed, 'lv');
        expect(lv).toEqual({Home: 'Sākums'});
    });

    it('is case-insensitive on the locale column', () => {
        const en = translationsFromCsv(parsed, 'EN');
        expect(en.Home).toBe('Home EN');
    });

    it('throws when the key column or target locale is missing', () => {
        const noKey = parseCsv('foo,en\nA,B\n');
        expect(() => translationsFromCsv(noKey, 'en')).toThrow(/key/);

        const noLocale = parseCsv('key,en\nA,B\n');
        expect(() => translationsFromCsv(noLocale, 'de')).toThrow(/de/);
    });
});
