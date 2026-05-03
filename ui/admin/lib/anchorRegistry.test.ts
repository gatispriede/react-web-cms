import {describe, expect, it, beforeEach} from 'vitest';
import {getAnchors, setAnchors} from './anchorRegistry';
import type {ISection} from '@interfaces/ISection';

/**
 * F1 sub-pages — anchor registry tree walk. Asserts the chain-walking
 * label format (`Parent → Child`) and href ordering (full slug-chain
 * joined by `/`).
 */
describe('anchorRegistry — sub-page chain walk', () => {
    beforeEach(() => {
        // Reset to a known empty state by handing in zero pages.
        setAnchors([], {});
    });

    const noSections: Record<string, ISection[]> = {};

    it('keeps existing flat behaviour for sites with only root pages', () => {
        setAnchors(
            [{id: 'about', page: 'About'}, {id: 'contact', page: 'Contact'}],
            noSections,
        );
        const pageEntries = getAnchors().filter(a => a.group === 'Pages');
        expect(pageEntries).toEqual([
            {href: '/about', label: 'About', group: 'Pages'},
            {href: '/contact', label: 'Contact', group: 'Pages'},
        ]);
    });

    it('emits chain hrefs and `→` labels for nested pages', () => {
        setAnchors(
            [
                {id: 'services', page: 'Services'},
                {id: 'cleaning', page: 'Cleaning', parent: 'services'},
                {id: 'office', page: 'Office', parent: 'cleaning'},
            ],
            noSections,
        );
        const pageEntries = getAnchors().filter(a => a.group === 'Pages');
        expect(pageEntries.map(a => a.href)).toEqual([
            '/services',
            '/services/cleaning',
            '/services/cleaning/office',
        ]);
        expect(pageEntries.map(a => a.label)).toEqual([
            'Services',
            'Services → Cleaning',
            'Services → Cleaning → Office',
        ]);
    });

    it('honours an explicit `slug` over the slugified `page` name', () => {
        setAnchors(
            [
                {id: 's', page: 'Our Services', slug: 'services'},
                {id: 'c', page: 'Cleaning Co', slug: 'cleaning', parent: 's'},
            ],
            noSections,
        );
        const pageEntries = getAnchors().filter(a => a.group === 'Pages');
        expect(pageEntries.map(a => a.href)).toEqual([
            '/services',
            '/services/cleaning',
        ]);
        // Labels keep the human-readable display name, not the slug.
        expect(pageEntries[1].label).toBe('Our Services → Cleaning Co');
    });

    it('treats orphans (parent id missing) as roots', () => {
        setAnchors(
            [
                {id: 'a', page: 'A'},
                {id: 'b', page: 'B', parent: 'gone'},
            ],
            noSections,
        );
        const pageEntries = getAnchors().filter(a => a.group === 'Pages');
        expect(pageEntries.map(a => a.href)).toEqual(['/a', '/b']);
        expect(pageEntries.map(a => a.label)).toEqual(['A', 'B']);
    });
});
