import {describe, it, expect} from 'vitest';
import {INavigation} from '@interfaces/INavigation';
import {buildCrumbs} from './Breadcrumb';

const pages: INavigation[] = [
    {id: 'r', type: 'navigation', page: 'Services', slug: 'services', sections: [], seo: undefined},
    {id: 's', parent: 'r', type: 'navigation', page: 'Cleaning', slug: 'cleaning', sections: [], seo: undefined},
    {id: 'g', parent: 's', type: 'navigation', page: 'Deep', slug: 'deep', sections: [], seo: undefined},
];

describe('Breadcrumb.buildCrumbs', () => {
    it('returns just the current page for a root', () => {
        const out = buildCrumbs(pages, pages[0]);
        expect(out.map(p => p.id)).toEqual(['r']);
    });
    it('walks parent chain in display order (root → leaf)', () => {
        const out = buildCrumbs(pages, pages[2]);
        expect(out.map(p => p.id)).toEqual(['r', 's', 'g']);
    });
    it('stops at orphan parent ref without throwing', () => {
        const orphans: INavigation[] = [
            {id: 'o', parent: 'gone', type: 'navigation', page: 'Orphan', sections: [], seo: undefined},
        ];
        const out = buildCrumbs(orphans, orphans[0]);
        expect(out.map(p => p.id)).toEqual(['o']);
    });
});
