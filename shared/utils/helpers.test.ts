import {describe, it, expect, vi} from 'vitest';
import {sanitizeKey} from './stringFunctions';
import {translateOrKeep} from './translateOrKeep';
import {htmlToBlocks} from './htmlBlocks';
import {extractTranslationsFromHTML} from './translationsutils';

describe('sanitizeKey', () => {
    it('strips whitespace / punctuation / brackets / quotes', () => {
        expect(sanitizeKey('Hello, world!')).toBe('Helloworld');
        expect(sanitizeKey('foo [bar] (baz)?')).toBe('foobarbaz?'); // `?` isn't in the strip class — preserved on purpose
        expect(sanitizeKey('mixed/slash.dot-hyphen_under')).toBe('mixedslashdothyphenunder');
    });

    it('returns stripped content verbatim when ≤ 30 chars', () => {
        expect(sanitizeKey('short sentence')).toBe('shortsentence');
        expect(sanitizeKey('a'.repeat(30))).toBe('a'.repeat(30));
    });

    it('caps at 30 chars by appending a stable hash suffix for long input', () => {
        const long = 'a'.repeat(60);
        const out = sanitizeKey(long);
        expect(out.length).toBe(30);
        // Deterministic — same input gives same key every call.
        expect(sanitizeKey(long)).toBe(out);
    });

    it('disambiguates two long strings that share the same 30-char prefix', () => {
        // Common failure mode before the hash suffix: stripped prefix of
        // 30 chars collides even though the full strings differ beyond
        // that point (e.g., paragraphs copy-edited from the tail).
        const a = 'The same opening phrase used twice for emphasis — variant A';
        const b = 'The same opening phrase used twice for emphasis — variant B';
        expect(sanitizeKey(a)).not.toBe(sanitizeKey(b));
        expect(sanitizeKey(a).length).toBe(30);
        expect(sanitizeKey(b).length).toBe(30);
    });

    it('returns non-string input unchanged (defensive guard)', () => {
        expect(sanitizeKey(undefined as any)).toBeUndefined();
        expect(sanitizeKey(42 as any)).toBe(42);
    });
});

describe('translateOrKeep', () => {
    it('returns the i18next translation when one exists', () => {
        const dict: Record<string, string> = {Home: 'Sākums'};
        const t = (k: string) => dict[k] ?? k;
        expect(translateOrKeep(t, 'Home')).toBe('Sākums');
    });

    it('falls back to the author-entered text when i18next returns the key itself', () => {
        // Simulates the missing-translation case: t(key) returns key.
        const t = (k: string) => k;
        expect(translateOrKeep(t, 'Unseen string')).toBe('Unseen string');
    });

    it('returns empty for falsy input; returns value when no t is given', () => {
        expect(translateOrKeep(undefined, '')).toBe('');
        expect(translateOrKeep(undefined, 'raw')).toBe('raw');
    });
});

describe('htmlToBlocks', () => {
    it('splits HTML into one block per visual paragraph', () => {
        const html = '<p>Hello <b>world</b></p><div>Second block</div>';
        expect(htmlToBlocks(html)).toEqual([{text: 'Hello world'}, {text: 'Second block'}]);
    });

    it('treats <br> as a block boundary and decodes common entities', () => {
        const html = 'line &amp; one<br>line &quot;two&quot;';
        expect(htmlToBlocks(html)).toEqual([{text: 'line & one'}, {text: 'line "two"'}]);
    });

    it('returns an empty array for non-string or empty input', () => {
        expect(htmlToBlocks(null)).toEqual([]);
        expect(htmlToBlocks('')).toEqual([]);
        expect(htmlToBlocks('   ')).toEqual([]);
    });
});

describe('extractTranslationsFromHTML', () => {
    it('replaces each paragraph text with its translation, keeping HTML tags intact', () => {
        const dict: Record<string, string> = {Hello: 'Sveiki'};
        const t = (k: string) => dict[k] ?? k;
        const html = '<p>Hello</p><p>World</p>';
        const out = extractTranslationsFromHTML(html, t);
        // First paragraph translated, second paragraph kept (translateOrKeep).
        expect(out).toBe('<p>Sveiki</p><p>World</p>');
    });

    it('returns empty string on non-string input', () => {
        expect(extractTranslationsFromHTML(null as any, vi.fn())).toBe('');
    });
});
