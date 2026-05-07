import {describe, expect, it} from 'vitest';
import {resolveSlugChain, slugChainForPage, NavRow} from './slugChain';
import {buildSitemapXml} from '@client/pages/api/sitemap.xml';

const tree: NavRow[] = [
    {id: 'r', page: 'Services', slug: 'services'},
    {id: 'c', page: 'Cleaning', slug: 'cleaning', parent: 'r'},
    {id: 'g', page: 'Eco', slug: 'eco', parent: 'c'},
    {id: 'h', page: 'Home', slug: 'home'},
    {id: 'legacy', page: 'About Us'}, // no slug field — falls back to slugifyAnchor
];

describe('resolveSlugChain', () => {
    it('resolves a 3-level chain', () => {
        expect(resolveSlugChain(tree, ['services', 'cleaning', 'eco'])?.id).toBe('g');
    });
    it('returns null on missing intermediate', () => {
        expect(resolveSlugChain(tree, ['nope', 'cleaning'])).toBeNull();
    });
    it('resolves a single-segment legacy page (slug from page name)', () => {
        expect(resolveSlugChain(tree, ['about-us'])?.id).toBe('legacy');
    });
    it('returns null on empty chain', () => {
        expect(resolveSlugChain(tree, [])).toBeNull();
    });

    it('resolves per-locale Record slug for the requested locale', () => {
        const localeTree: NavRow[] = [
            {id: 'r', page: 'About', slug: {en: 'about', lv: 'par-mums'} as any},
        ];
        expect(resolveSlugChain(localeTree, ['par-mums'], 'lv', 'en')?.id).toBe('r');
        expect(resolveSlugChain(localeTree, ['about'], 'en', 'en')?.id).toBe('r');
    });

    it('falls back to defaultLocale when requested locale missing in Record', () => {
        const localeTree: NavRow[] = [
            {id: 'r', page: 'About', slug: {en: 'about'} as any},
        ];
        expect(resolveSlugChain(localeTree, ['about'], 'de', 'en')?.id).toBe('r');
    });

    it('back-compat — bare-string slug resolves for any locale', () => {
        const legacyOnly: NavRow[] = [{id: 'h', page: 'Home', slug: 'home'}];
        expect(resolveSlugChain(legacyOnly, ['home'], 'lv', 'en')?.id).toBe('h');
    });

    // Legacy URL tolerance — see NavigationService.test.ts equivalents.
    it('resolves a legacy URL with percent-encoded diacritics + trailing dash', () => {
        const legacy: NavRow[] = [
            {id: 'n', page: 'Jaunumi un aktualitātes ', slug: 'jaunumi-un-aktualitates'},
        ];
        expect(resolveSlugChain(legacy, ['jaunumi-un-aktualit%C4%81tes-'])?.id).toBe('n');
    });

    it('resolves a chain whose segment differs only in case', () => {
        const legacy: NavRow[] = [{id: 'p', page: 'Pakalpojumi', slug: 'pakalpojumi'}];
        expect(resolveSlugChain(legacy, ['Pakalpojumi'])?.id).toBe('p');
    });

    it('resolves a chain with raw (decoded) diacritics and no trailing dash', () => {
        const legacy: NavRow[] = [
            {id: 'n', page: 'Jaunumi un aktualitātes', slug: 'jaunumi-un-aktualitates'},
        ];
        expect(resolveSlugChain(legacy, ['jaunumi-un-aktualitātes'])?.id).toBe('n');
    });

    it('returns null for a nonexistent chain (negative case)', () => {
        const legacy: NavRow[] = [{id: 'h', page: 'Home', slug: 'home'}];
        expect(resolveSlugChain(legacy, ['nonexistent'])).toBeNull();
    });
});

describe('slugChainForPage', () => {
    it('emits the full chain root → leaf', () => {
        const eco = tree.find(p => p.id === 'g')!;
        expect(slugChainForPage(eco, tree)).toEqual(['services', 'cleaning', 'eco']);
    });
    it('emits a single-element chain for root pages', () => {
        const home = tree.find(p => p.id === 'h')!;
        expect(slugChainForPage(home, tree)).toEqual(['home']);
    });
    it('returns [] for orphans (parent missing)', () => {
        const orphan: NavRow = {id: 'x', page: 'X', slug: 'x', parent: 'gone'};
        expect(slugChainForPage(orphan, [orphan])).toEqual([]);
    });
});

describe('buildSitemapXml', () => {
    it('produces a URL per page in a 3-level tree', () => {
        const xml = buildSitemapXml({
            pages: tree,
            locales: ['en'],
            defaultLocale: 'en',
            origin: 'https://example.com',
        });
        expect(xml).toContain('<loc>https://example.com/services</loc>');
        expect(xml).toContain('<loc>https://example.com/services/cleaning</loc>');
        expect(xml).toContain('<loc>https://example.com/services/cleaning/eco</loc>');
        expect(xml).toContain('<loc>https://example.com/home</loc>');
        expect(xml).toContain('<loc>https://example.com/about-us</loc>');
    });

    it('emits one URL per locale, default locale unprefixed', () => {
        const xml = buildSitemapXml({
            pages: [{id: 'h', page: 'Home', slug: 'home'}],
            locales: ['en', 'lv'],
            defaultLocale: 'en',
            origin: 'https://example.com',
        });
        expect(xml).toContain('<loc>https://example.com/home</loc>');
        expect(xml).toContain('<loc>https://example.com/lv/home</loc>');
    });

    it('emits per-locale URLs from a Record slug, with hreflang alternates', () => {
        const xml = buildSitemapXml({
            pages: [{id: 'r', page: 'About', slug: {en: 'about', lv: 'par-mums'} as any}],
            locales: ['en', 'lv'],
            defaultLocale: 'en',
            origin: 'https://example.com',
        });
        // One <url> per locale, each with the locale-specific slug.
        expect(xml).toContain('<loc>https://example.com/about</loc>');
        expect(xml).toContain('<loc>https://example.com/lv/par-mums</loc>');
        // hreflang alternates link the two URLs as translations of
        // each other so search engines surface the right locale.
        expect(xml).toContain('xhtml:link rel="alternate" hreflang="en" href="https://example.com/about"');
        expect(xml).toContain('xhtml:link rel="alternate" hreflang="lv" href="https://example.com/lv/par-mums"');
    });

    it('skips orphans (dangling parent)', () => {
        const xml = buildSitemapXml({
            pages: [{id: 'x', page: 'X', slug: 'x', parent: 'gone'}],
            locales: ['en'],
            defaultLocale: 'en',
            origin: 'https://example.com',
        });
        expect(xml).not.toContain('<loc>https://example.com/x</loc>');
    });

    it('emits /blog index + one URL per published post (skips drafts)', () => {
        const xml = buildSitemapXml({
            pages: [],
            locales: ['en'],
            defaultLocale: 'en',
            origin: 'https://example.com',
            posts: [
                {slug: 'first-post', publishedAt: '2026-05-01T00:00:00Z'},
                {slug: 'draft-post', draft: true},
                {slug: 'mcp-walkthrough', publishedAt: '2026-05-06T00:00:00Z', editedAt: '2026-05-07T00:00:00Z'},
            ],
        });
        expect(xml).toContain('<loc>https://example.com/blog</loc>');
        expect(xml).toContain('<loc>https://example.com/blog/first-post</loc>');
        expect(xml).toContain('<loc>https://example.com/blog/mcp-walkthrough</loc>');
        // editedAt wins over publishedAt for lastmod.
        expect(xml).toContain('<lastmod>2026-05-07T00:00:00Z</lastmod>');
        expect(xml).not.toContain('draft-post');
    });

    it('omits blog entries when blogEnabled is false', () => {
        const xml = buildSitemapXml({
            pages: [],
            locales: ['en'],
            defaultLocale: 'en',
            origin: 'https://example.com',
            posts: [{slug: 'first-post'}],
            blogEnabled: false,
        });
        expect(xml).not.toContain('/blog');
    });
});
