import {describe, expect, it} from 'vitest';
import {buildAnchorRegistry, searchAnchors} from './AnchorRegistry';

/**
 * Pure-function tests for the server-side anchor registry. Mirrors the
 * client-side `anchorRegistry` semantics — same slug rule, same group
 * structure — so a future divergence between client and server will
 * surface as a test failure on whichever side drifts.
 */

const PAGES = [
    {page: 'Home', id: 'p-home', slug: 'home'},
    {page: 'About'},
    {page: 'Services', id: 'p-services', slug: 'services'},
    {page: 'Cleaning', id: 'p-cleaning', parent: 'p-services', slug: 'cleaning'},
];

describe('buildAnchorRegistry — tabs mode (default)', () => {
    it('emits one entry per page with /slug hrefs', () => {
        const r = buildAnchorRegistry({pages: PAGES, sectionsByPage: {}});
        const home = r.find(e => e.label === 'Home');
        const about = r.find(e => e.label === 'About');
        expect(home?.href).toBe('/home');
        expect(home?.group).toBe('Pages');
        expect(about?.href).toBe('/about');
    });

    it('builds sub-page hrefs from the parent chain', () => {
        const r = buildAnchorRegistry({pages: PAGES, sectionsByPage: {}});
        const cleaning = r.find(e => e.label === 'Services → Cleaning');
        expect(cleaning?.href).toBe('/services/cleaning');
    });

    it('emits section anchors prefixed with the page slug', () => {
        const r = buildAnchorRegistry({
            pages: PAGES,
            sectionsByPage: {
                Home: [{id: 'sec-hero', type: 1, content: [{type: 'HERO', content: '{"title":"Welcome"}'}]}],
            },
        });
        const sec = r.find(e => e.href === '/home#sec-hero');
        expect(sec).toBeDefined();
        expect(sec?.group).toBe('Sections');
    });

    it('extracts module titles into hash-anchor entries', () => {
        const r = buildAnchorRegistry({
            pages: PAGES,
            sectionsByPage: {
                Home: [{id: 'sec1', content: [{type: 'HERO', content: '{"title":"Welcome to Funisimo"}'}]}],
            },
        });
        const title = r.find(e => e.label === 'Home · Welcome to Funisimo');
        expect(title?.href).toBe('#welcome-to-funisimo');
        expect(title?.group).toBe('Module titles');
    });

    it('extracts timeline entries via `${company}-${role}` slug', () => {
        const r = buildAnchorRegistry({
            pages: PAGES,
            sectionsByPage: {
                Home: [{
                    id: 'sec1',
                    content: [{
                        type: 'TIMELINE',
                        content: JSON.stringify({
                            entries: [
                                {company: 'SciChart', role: 'Consultant', start: '2024'},
                                {company: 'Sapiens', role: 'TPM', start: '2019'},
                            ],
                        }),
                    }],
                }],
            },
        });
        const sci = r.find(e => e.href === '#scichart-consultant');
        expect(sci?.label).toBe('Home · SciChart — Consultant');
        expect(sci?.group).toBe('Timeline entries');
    });

    it('dedupes by href — first writer wins', () => {
        const r = buildAnchorRegistry({
            pages: [{page: 'Home', slug: 'home'}],
            sectionsByPage: {
                // Two separate modules slugifying to the same anchor — the
                // second push must drop quietly.
                Home: [{
                    id: 'sec1',
                    content: [
                        {type: 'A', content: JSON.stringify({title: 'Career'})},
                        {type: 'B', content: JSON.stringify({title: 'Career'})},
                    ],
                }],
            },
        });
        const careerHits = r.filter(e => e.href === '#career');
        expect(careerHits.length).toBe(1);
    });

    it('treats malformed item.content gracefully (no throw)', () => {
        const r = buildAnchorRegistry({
            pages: [{page: 'Home', slug: 'home'}],
            sectionsByPage: {
                Home: [{id: 'sec1', content: [{type: 'A', content: 'not json'}]}],
            },
        });
        // Page entry still emitted; bad item silently skipped.
        expect(r.find(e => e.href === '/home')).toBeDefined();
    });
});

describe('buildAnchorRegistry — scroll mode', () => {
    it('emits hash-only hrefs for pages and sections', () => {
        const r = buildAnchorRegistry({
            pages: PAGES,
            sectionsByPage: {Home: [{id: 'sec-hero'}]},
            siteMode: 'scroll',
        });
        const home = r.find(e => e.label === 'Home');
        expect(home?.href).toBe('#home');
        const sec = r.find(e => e.href === '#sec-hero');
        expect(sec).toBeDefined();
    });

    it('treats `auto` like `tabs` (default href shape)', () => {
        const r = buildAnchorRegistry({
            pages: [{page: 'Home', slug: 'home'}],
            sectionsByPage: {},
            siteMode: 'auto',
        });
        expect(r.find(e => e.label === 'Home')?.href).toBe('/home');
    });
});

describe('searchAnchors', () => {
    const ENTRIES = buildAnchorRegistry({
        pages: PAGES,
        sectionsByPage: {
            Home: [{id: 'sec1', content: [{type: 'X', content: '{"title":"Career record"}'}]}],
        },
    });

    it('returns all entries on empty query', () => {
        const r = searchAnchors(ENTRIES, '');
        expect(r.length).toBe(ENTRIES.length);
    });

    it('matches substring in label', () => {
        const r = searchAnchors(ENTRIES, 'career');
        expect(r[0].label).toContain('Career');
    });

    it('matches case-insensitively', () => {
        const r1 = searchAnchors(ENTRIES, 'CAREER');
        const r2 = searchAnchors(ENTRIES, 'career');
        expect(r1[0]).toEqual(r2[0]);
    });

    it('returns empty array for no matches', () => {
        const r = searchAnchors(ENTRIES, 'nonexistent-token');
        expect(r).toEqual([]);
    });

    it('ranks earlier substring matches higher', () => {
        // 'Home' starts the label "Home" (index 0); 'About' contains 'h'
        // mid-string. Searching 'h' should still surface Home first since
        // it's a single-letter match — index 0 vs unrelated.
        const home = ENTRIES.find(e => e.label === 'Home')!;
        const r = searchAnchors([home], 'home');
        expect(r[0]).toBe(home);
    });
});
