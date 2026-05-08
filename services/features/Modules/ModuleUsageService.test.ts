import {describe, it, expect} from 'vitest';
import {scanModuleUsage} from './ModuleUsageService';

describe('scanModuleUsage', () => {
    it('counts instances of each known type and dedupes pages', () => {
        const result = scanModuleUsage({
            types: ['HERO', 'GALLERY', 'RICH_TEXT'],
            sections: [
                {page: 'Home', content: [{type: 'HERO'}, {type: 'RICH_TEXT'}]},
                {page: 'Home', content: [{type: 'HERO'}]},
                {page: 'About', content: [{type: 'GALLERY'}]},
            ],
        });
        const hero = result.find(r => r.type === 'HERO')!;
        expect(hero.usageCount).toBe(2);
        expect(hero.pages).toEqual(['Home']);
        expect(result.find(r => r.type === 'GALLERY')!.pages).toEqual(['About']);
    });

    it('returns rows with usageCount 0 for types that never appear', () => {
        const result = scanModuleUsage({
            types: ['HERO', 'TIMELINE'],
            sections: [{page: 'Home', content: [{type: 'HERO'}]}],
        });
        const timeline = result.find(r => r.type === 'TIMELINE')!;
        expect(timeline.usageCount).toBe(0);
        expect(timeline.pages).toEqual([]);
    });

    it('ignores unknown types in section content (not in the registry)', () => {
        const result = scanModuleUsage({
            types: ['HERO'],
            sections: [{page: 'Home', content: [{type: 'HERO'}, {type: 'UNKNOWN_LEGACY'}]}],
        });
        expect(result).toHaveLength(1);
        expect(result[0]!.usageCount).toBe(1);
    });

    it('handles sections with no page and no content', () => {
        const result = scanModuleUsage({
            types: ['HERO'],
            sections: [{content: [{type: 'HERO'}]}, {page: 'Home'}],
        });
        const hero = result[0]!;
        expect(hero.usageCount).toBe(1);
        expect(hero.pages).toEqual([]); // section without `page` doesn't contribute
    });
});
