import {describe, expect, it} from 'vitest';
import {
    currencyForLocale,
    isSupportedCurrency,
    pickPrice,
    resolveDisplayCurrency,
} from './displayCurrency';

describe('displayCurrency — locale → currency', () => {
    it('maps spec-worked examples: lv → EUR, en-GB → GBP', () => {
        expect(currencyForLocale('lv')).toBe('EUR');
        expect(currencyForLocale('en-GB')).toBe('GBP');
    });

    it('falls back to the bare language subtag when the full tag is unknown', () => {
        expect(currencyForLocale('de-AT')).toBe('EUR'); // de → EUR
        expect(currencyForLocale('sv-FI')).toBe('SEK');  // sv → SEK
    });

    it('returns undefined for an unmapped locale', () => {
        expect(currencyForLocale('ja')).toBeUndefined();
        expect(currencyForLocale('')).toBeUndefined();
        expect(currencyForLocale(undefined)).toBeUndefined();
    });

    it('isSupportedCurrency is case-insensitive and rejects junk', () => {
        expect(isSupportedCurrency('eur')).toBe(true);
        expect(isSupportedCurrency('GBP')).toBe(true);
        expect(isSupportedCurrency('XYZ')).toBe(false);
        expect(isSupportedCurrency(null)).toBe(false);
    });
});

describe('displayCurrency — resolveDisplayCurrency priority', () => {
    it('cookie override beats everything', () => {
        expect(resolveDisplayCurrency({
            cookieCurrency: 'USD', userPreferred: 'GBP', siteDefault: 'SEK', locale: 'lv', baseCurrency: 'EUR',
        })).toBe('USD');
    });

    it('user preference beats site default + locale', () => {
        expect(resolveDisplayCurrency({userPreferred: 'GBP', siteDefault: 'SEK', locale: 'lv'})).toBe('GBP');
    });

    it('site default beats locale', () => {
        expect(resolveDisplayCurrency({siteDefault: 'SEK', locale: 'lv'})).toBe('SEK');
    });

    it('falls through to the locale mapping', () => {
        expect(resolveDisplayCurrency({locale: 'en-GB'})).toBe('GBP');
        expect(resolveDisplayCurrency({locale: 'lv'})).toBe('EUR');
    });

    it('hard-falls back to baseCurrency, then EUR', () => {
        expect(resolveDisplayCurrency({baseCurrency: 'USD'})).toBe('USD');
        expect(resolveDisplayCurrency({})).toBe('EUR');
    });

    it('ignores unsupported values at each tier', () => {
        expect(resolveDisplayCurrency({cookieCurrency: 'XYZ', locale: 'en-GB'})).toBe('GBP');
    });
});

describe('displayCurrency — pickPrice', () => {
    it('returns a native hit when the display currency is in the map', () => {
        const p = pickPrice({EUR: 199000, GBP: 169000}, 'GBP');
        expect(p).toEqual({amount: 169000, currency: 'GBP', native: true});
    });

    it('falls back to baseCurrency with native=false when no display-currency entry', () => {
        const p = pickPrice({EUR: 199000}, 'USD', {baseCurrency: 'EUR'});
        expect(p).toEqual({amount: 199000, currency: 'EUR', native: false});
    });

    it('synthesizes a map from legacy price/currency for un-migrated products', () => {
        const p = pickPrice(undefined, 'EUR', {legacyPrice: 5000, legacyCurrency: 'EUR'});
        expect(p).toEqual({amount: 5000, currency: 'EUR', native: true});
    });

    it('falls back to the first available entry when neither display nor base match', () => {
        const p = pickPrice({SEK: 50000}, 'USD', {baseCurrency: 'EUR'});
        expect(p).toEqual({amount: 50000, currency: 'SEK', native: false});
    });

    it('returns null when there is no price at all', () => {
        expect(pickPrice(undefined, 'EUR')).toBeNull();
        expect(pickPrice({}, 'EUR')).toBeNull();
    });
});
