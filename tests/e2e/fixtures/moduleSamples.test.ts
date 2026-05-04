import {describe, expect, it} from 'vitest';
import {EItemType} from '@enums/EItemType';
import {assertRegistryComplete, buildSamples, mulberry32, sampleMarker, shuffleInPlace} from './moduleSamples';

// CI gate: a new `EItemType` member that lacks a sample (and isn't on the
// explicit omissions list) fails this test, blocking the PR until the
// author either adds a sample or documents why the type is exempt.
//
// This file lives under `tests/e2e/` but is picked up by the main Vitest
// suite (vitest.config.ts includes `services/**` and friends — adding
// `tests/e2e/fixtures/**.test.ts` would expand the include set; instead
// we register this here under the existing pattern). If Vitest doesn't
// pick it up, the chain spec itself will trip the assertion at runtime.

describe('e2e moduleSamples registry', () => {
    it('covers every non-omitted EItemType', () => {
        expect(() => assertRegistryComplete()).not.toThrow();
    });

    it('builds stable marker text per (type, runId)', () => {
        const a = sampleMarker(EItemType.RichText, 'run-1');
        const b = sampleMarker(EItemType.RichText, 'run-1');
        const c = sampleMarker(EItemType.RichText, 'run-2');
        expect(a).toBe(b);
        expect(a).not.toBe(c);
    });

    it('returns one sample per supported type', () => {
        const samples = buildSamples('test');
        const types = new Set(samples.map(s => s.type));
        expect(types.size).toBe(samples.length);
    });

    it('mulberry32 is deterministic for the same seed', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    });

    it('shuffleInPlace is deterministic with seeded RNG', () => {
        const left = [1, 2, 3, 4, 5];
        const right = [1, 2, 3, 4, 5];
        shuffleInPlace(left, mulberry32(7));
        shuffleInPlace(right, mulberry32(7));
        expect(left).toEqual(right);
    });
});
