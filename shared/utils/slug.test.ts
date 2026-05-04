import {describe, expect, it} from 'vitest';
import {normalizeSlugForMatch} from './slug';

describe('normalizeSlugForMatch', () => {
    it('lowercases mixed case input', () => {
        expect(normalizeSlugForMatch('Pakalpojumi')).toBe('pakalpojumi');
        expect(normalizeSlugForMatch('SERVICES/CLEANING')).toBe('services/cleaning');
    });

    it('strips combining diacritics (NFKD)', () => {
        expect(normalizeSlugForMatch('jaunumi-un-aktualitātes')).toBe('jaunumi-un-aktualitates');
    });

    it('decodes percent-encoded diacritics', () => {
        expect(normalizeSlugForMatch('jaunumi-un-aktualit%C4%81tes')).toBe('jaunumi-un-aktualitates');
    });

    it('converts trailing whitespace to a trailing dash, then strips it', () => {
        expect(normalizeSlugForMatch('Jaunumi un aktualitātes ')).toBe('jaunumi-un-aktualitates');
    });

    it('collapses repeated dashes', () => {
        expect(normalizeSlugForMatch('foo---bar')).toBe('foo-bar');
    });

    it('strips leading/trailing dashes', () => {
        expect(normalizeSlugForMatch('-home-')).toBe('home');
    });

    it('handles malformed percent-encoding without throwing', () => {
        expect(normalizeSlugForMatch('%E0%A4%A')).toBe('%e0%a4%a');
    });

    it('returns empty string for empty input', () => {
        expect(normalizeSlugForMatch('')).toBe('');
    });

    it('is idempotent', () => {
        const cases = [
            'Jaunumi un aktualitātes ',
            'jaunumi-un-aktualit%C4%81tes-',
            'Pakalpojumi',
            'foo---bar',
        ];
        for (const c of cases) {
            const once = normalizeSlugForMatch(c);
            const twice = normalizeSlugForMatch(once);
            expect(twice).toBe(once);
        }
    });

    it('round-trip — encoded and raw forms collapse to the same slug', () => {
        const raw = normalizeSlugForMatch('Jaunumi un aktualitātes ');
        const encoded = normalizeSlugForMatch('jaunumi-un-aktualit%C4%81tes-');
        expect(raw).toBe(encoded);
    });
});
