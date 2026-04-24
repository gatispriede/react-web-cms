import {describe, it, expect} from 'vitest';
import {GOOGLE_FONTS, buildFontStack, buildGoogleFontsUrl, extractFontFamily} from './googleFonts';

describe('googleFonts helpers', () => {
    describe('extractFontFamily', () => {
        it('pulls the leading single-quoted family from a CSS stack', () => {
            expect(extractFontFamily(`'Inter Tight', system-ui, -apple-system, sans-serif`)).toBe('Inter Tight');
        });

        it('handles double quotes equivalently', () => {
            expect(extractFontFamily(`"JetBrains Mono", ui-monospace, monospace`)).toBe('JetBrains Mono');
        });

        it('returns null for system-only stacks (no quoted family to load)', () => {
            expect(extractFontFamily('system-ui, sans-serif')).toBeNull();
            expect(extractFontFamily('')).toBeNull();
            expect(extractFontFamily(undefined)).toBeNull();
        });
    });

    describe('buildFontStack', () => {
        it('uses the family\'s catalogue category for the fallback chain', () => {
            const sans = buildFontStack('Inter');
            expect(sans).toMatch(/^'Inter',/);
            expect(sans).toContain('sans-serif');

            const mono = buildFontStack('JetBrains Mono');
            expect(mono).toContain('monospace');

            const serif = buildFontStack('Fraunces');
            expect(serif).toContain('serif');
        });

        it('falls back to a generic system stack for off-catalogue families', () => {
            const stack = buildFontStack('NotInCatalogue');
            expect(stack).toMatch(/^'NotInCatalogue',/);
            expect(stack).toContain('system-ui');
        });
    });

    describe('buildGoogleFontsUrl', () => {
        it('returns null when no families are supplied', () => {
            expect(buildGoogleFontsUrl([])).toBeNull();
            expect(buildGoogleFontsUrl([null, undefined])).toBeNull();
        });

        it('encodes families with spaces as `+` and joins weights with `;` ascending', () => {
            const url = buildGoogleFontsUrl(['Inter Tight']);
            expect(url).toContain('family=Inter+Tight:wght@400;500;600;700');
            expect(url).toContain('display=swap');
        });

        it('dedupes case-insensitively so `BUNDLED + active theme` doesn\'t double-load', () => {
            const url = buildGoogleFontsUrl(['Inter', 'inter', 'INTER']);
            const matches = url?.match(/family=Inter:/g);
            expect(matches?.length).toBe(1);
        });

        it('emits one `family=` segment per supplied family in input order', () => {
            const url = buildGoogleFontsUrl(['Inter', 'Fraunces', 'JetBrains Mono']);
            const families = url?.match(/family=[^&]+/g) ?? [];
            expect(families.length).toBe(3);
            expect(families[0]).toContain('Inter');
            expect(families[1]).toContain('Fraunces');
            expect(families[2]).toContain('JetBrains+Mono');
        });

        it('uses safe default weights for unknown families so we don\'t 404 the URL', () => {
            const url = buildGoogleFontsUrl(['NotInCatalogue']);
            expect(url).toContain('family=NotInCatalogue:wght@400;700');
        });
    });

    describe('catalogue shape', () => {
        it('every entry has the four required fields', () => {
            for (const f of GOOGLE_FONTS) {
                expect(typeof f.family).toBe('string');
                expect(['sans-serif', 'serif', 'display', 'handwriting', 'monospace']).toContain(f.category);
                expect(Array.isArray(f.variants)).toBe(true);
                expect(f.variants.length).toBeGreaterThan(0);
                expect(Array.isArray(f.subsets)).toBe(true);
            }
        });
    });
});
