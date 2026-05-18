import {describe, it, expect} from 'vitest';
import {isReservedPageSlug, assertNotReservedPageSlug, RESERVED_PAGE_SLUGS} from './reservedSlugs';

describe('reservedSlugs', () => {
    describe('isReservedPageSlug', () => {
        it.each([
            // Built-ins shipped pre-Phase-1
            'admin', 'blog', 'app', 'auth', 'dev',
            // Commerce surface (Phase 1.B/D system pages — file-system routes that
            // would shadow operator pages of the same name).
            'cart', 'checkout', 'account', 'orders', 'products',
            // Static marketing + legal
            'welcome', 'privacy', 'terms', 'docs',
            // Next + framework
            'api', '_next', '404', '500',
            // i18n locale prefixes
            'en', 'lv',
            // Sentinel
            'test',
        ])('blocks %s', (slug) => {
            expect(isReservedPageSlug(slug)).toBe(true);
        });

        it.each([
            'about', 'pricing', 'features', 'contact', 'support',
            'team', 'press', 'changelog',
        ])('allows %s', (slug) => {
            expect(isReservedPageSlug(slug)).toBe(false);
        });

        it('is case-insensitive + trims whitespace', () => {
            expect(isReservedPageSlug('  Cart  ')).toBe(true);
            expect(isReservedPageSlug('CHECKOUT')).toBe(true);
            expect(isReservedPageSlug('Products')).toBe(true);
        });

        it('returns false for non-string / empty input', () => {
            expect(isReservedPageSlug(null)).toBe(false);
            expect(isReservedPageSlug(undefined)).toBe(false);
            expect(isReservedPageSlug('')).toBe(false);
            expect(isReservedPageSlug(42)).toBe(false);
        });
    });

    describe('assertNotReservedPageSlug', () => {
        it('throws on reserved slugs', () => {
            expect(() => assertNotReservedPageSlug('checkout')).toThrowError(/reserved/);
            expect(() => assertNotReservedPageSlug('account')).toThrowError(/reserved/);
        });
        it('is a no-op for free slugs', () => {
            expect(() => assertNotReservedPageSlug('about')).not.toThrow();
        });
    });

    it('keeps every commerce-surface route in the list — regression guard', () => {
        // The Phase 1.B/D system-page sweep added five file-system routes
        // (cart / checkout / account / orders / products) that previously
        // existed only in spec. Hard-pin them here so a future cleanup
        // pass can't drop them without explicitly seeing this test fail.
        for (const slug of ['cart', 'checkout', 'account', 'orders', 'products']) {
            expect(RESERVED_PAGE_SLUGS).toContain(slug);
        }
    });
});
