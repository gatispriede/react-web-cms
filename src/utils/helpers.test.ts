import {describe, it, expect, vi} from 'vitest';
import {sanitizeKey, sanitizeKeyV2} from './stringFunctions';
import {translateOrKeep} from './translateOrKeep';
import {htmlToBlocks} from './htmlBlocks';
import {extractTranslationsFromHTML} from './translationsutils';

describe('sanitizeKey', () => {
    // WARNING: production regex has a latent bug — the character class closes
    // early on an unescaped `]`, so most "special" characters aren't actually
    // stripped. We lock in current behaviour here: "anything that fits in 30
    // chars returns unchanged". Fixing the regex would re-key every existing
    // translation and is deferred (see ROADMAP Debt).
    it('caps at 30 characters', () => {
        const long = 'a'.repeat(60);
        expect(sanitizeKey(long).length).toBe(30);
    });

    it('returns non-string input unchanged (defensive guard)', () => {
        expect(sanitizeKey(undefined as any)).toBeUndefined();
        expect(sanitizeKey(42 as any)).toBe(42);
    });
});

describe('sanitizeKeyV2 (correct char class)', () => {
    it('strips the full special set that v1 fails to strip', () => {
        expect(sanitizeKeyV2('Hello, world!')).toBe('Helloworld');
        expect(sanitizeKeyV2('foo [bar] (baz)?')).toBe('foobarbaz?'); // `?` is not in the class — preserved
        expect(sanitizeKeyV2('mixed/slash.dot-hyphen_under')).toBe('mixedslashdothyphenunder');
    });

    it('still caps at 30 chars', () => {
        expect(sanitizeKeyV2('a'.repeat(60)).length).toBe(30);
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
