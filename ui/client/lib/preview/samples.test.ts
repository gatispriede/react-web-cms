/**
 * Guard-rail for C10 modules-preview coverage. Policy: every `EItemType`
 * member (except explicit exemptions like `Empty`) has **exactly two**
 * samples in `samples.ts` — a `minimal` one (required fields only) and a
 * `full` one (every optional field populated). Add a new module type
 * without its two fixtures → these tests fail, so the preview page can't
 * silently render a gap.
 */
import {describe, it, expect} from 'vitest';
import {EItemType} from '@enums/EItemType';
import {sampleContent, missingSampleTypes} from './samples';

const EXEMPT = new Set<string>([EItemType.Empty]);

describe('modules-preview samples', () => {
    it('has a sample for every EItemType except Empty', () => {
        const missing = missingSampleTypes();
        expect(missing).toEqual([]);
    });

    it('every sample is valid JSON with a non-empty label', () => {
        for (const [, samples] of Object.entries(sampleContent)) {
            for (const sample of samples) {
                expect(() => JSON.parse(sample.content)).not.toThrow();
                expect(typeof sample.label).toBe('string');
                expect(sample.label.length).toBeGreaterThan(0);
            }
        }
    });

    it('covers every declared EItemType key (exemptions explicit)', () => {
        for (const v of Object.values(EItemType)) {
            if (EXEMPT.has(v)) continue;
            expect(sampleContent[v]).toBeDefined();
            expect(Array.isArray(sampleContent[v])).toBe(true);
            expect(sampleContent[v].length).toBeGreaterThan(0);
        }
    });

    it('has exactly two samples per module — minimal + full', () => {
        for (const v of Object.values(EItemType)) {
            if (EXEMPT.has(v)) continue;
            const samples = sampleContent[v];
            expect(samples, `missing samples for ${v}`).toBeDefined();
            expect(samples.length, `${v} must have exactly 2 samples`).toBe(2);
            expect(samples.map(x => x.label)).toEqual(['minimal', 'full']);
        }
    });
});
