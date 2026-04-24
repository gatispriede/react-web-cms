/**
 * Guard-rail for C10 modules-preview coverage: every `EItemType` member
 * (except explicit exemptions like `Empty`) must have at least one sample
 * in `samples.ts`. Add a new module type without a fixture → this test
 * fails, the preview page can't silently render a gap.
 */
import {EItemType} from '@enums/EItemType';
import {sampleContent, missingSampleTypes} from './samples';

describe('modules-preview samples', () => {
    it('has at least one sample for every EItemType except Empty', () => {
        const missing = missingSampleTypes();
        expect(missing).toEqual([]);
    });

    it('every sample is valid JSON', () => {
        for (const [key, samples] of Object.entries(sampleContent)) {
            for (const s of samples) {
                expect(() => JSON.parse(s.content)).not.toThrow();
                expect(typeof s.label).toBe('string');
                expect(s.label.length).toBeGreaterThan(0);
            }
        }
    });

    it('covers every declared EItemType key (exemptions explicit)', () => {
        const EXEMPT = new Set<string>([EItemType.Empty]);
        for (const v of Object.values(EItemType)) {
            if (EXEMPT.has(v)) continue;
            expect(sampleContent[v]).toBeDefined();
            expect(Array.isArray(sampleContent[v])).toBe(true);
            const arr = sampleContent[v];
            expect(Array.isArray(arr) && arr.length > 0).toBe(true);
        }
    });
});
