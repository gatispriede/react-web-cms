import {describe, it, expect} from 'vitest';
import {scanPostStats} from './PostStatsService';

describe('scanPostStats', () => {
    it('counts plain-text words after stripping HTML', () => {
        const [stats] = scanPostStats([{
            slug: 'hello',
            body: '<p>Hello <strong>world</strong> from CMS</p>',
            tags: [],
        }]);
        expect(stats!.wordCount).toBe(4);
    });

    it('counts <img> tags inside the body', () => {
        const [stats] = scanPostStats([{
            slug: 'p1',
            body: '<p>Foo</p><img src="a.jpg"/><img src="b.jpg"><img src="c.jpg"/>',
            tags: [],
        }]);
        expect(stats!.imageCount).toBe(3);
    });

    it('adds one to imageCount when coverImage is set', () => {
        const [stats] = scanPostStats([{
            slug: 'p1',
            body: '<p>Foo</p><img src="a.jpg"/>',
            coverImage: 'cover.jpg',
            tags: [],
        }]);
        expect(stats!.imageCount).toBe(2);
    });

    it('returns zero counts for an empty post', () => {
        const [stats] = scanPostStats([{slug: 'empty'}]);
        expect(stats).toEqual({slug: 'empty', wordCount: 0, imageCount: 0, tagCount: 0});
    });

    it('counts tags using array length', () => {
        const [stats] = scanPostStats([{
            slug: 'p1',
            body: '',
            tags: ['cms', 'release', 'roadmap'],
        }]);
        expect(stats!.tagCount).toBe(3);
    });
});
