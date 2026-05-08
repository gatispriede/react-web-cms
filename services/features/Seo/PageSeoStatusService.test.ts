import {describe, it, expect} from 'vitest';
import {scanPageSeo} from './PageSeoStatusService';

describe('scanPageSeo', () => {
    it('flags every field as missing when seo is null', () => {
        const [home] = scanPageSeo([{page: 'Home', seo: null}]);
        expect(home!.hasDescription).toBe(false);
        expect(home!.hasOgImage).toBe(false);
        expect(home!.hasKeywords).toBe(false);
        expect(home!.hasAuthor).toBe(false);
        expect(home!.missingFields).toEqual(['description', 'og-image', 'keywords', 'author']);
    });

    it('reports a fully populated SEO doc as complete', () => {
        const [home] = scanPageSeo([{
            page: 'Home',
            seo: {description: 'About us', image: 'home.jpg', keywords: ['cms'], author: 'Gatis'},
        }]);
        expect(home!.missingFields).toEqual([]);
        expect(home!.hasDescription).toBe(true);
        expect(home!.hasOgImage).toBe(true);
        expect(home!.hasKeywords).toBe(true);
        expect(home!.hasAuthor).toBe(true);
    });

    it('treats whitespace-only strings and empty keyword arrays as missing', () => {
        const [home] = scanPageSeo([{
            page: 'Home',
            seo: {description: '   ', image: '', keywords: [], author: 'Author'},
        }]);
        expect(home!.hasDescription).toBe(false);
        expect(home!.hasOgImage).toBe(false);
        expect(home!.hasKeywords).toBe(false);
        expect(home!.hasAuthor).toBe(true);
        expect(home!.missingFields).toEqual(['description', 'og-image', 'keywords']);
    });

    it('processes multiple pages independently', () => {
        const result = scanPageSeo([
            {page: 'Home', seo: {description: 'd', image: 'i', keywords: ['k'], author: 'a'}},
            {page: 'Contact', seo: null},
        ]);
        expect(result.find(r => r.page === 'Home')!.missingFields).toEqual([]);
        expect(result.find(r => r.page === 'Contact')!.missingFields.length).toBe(4);
    });
});
