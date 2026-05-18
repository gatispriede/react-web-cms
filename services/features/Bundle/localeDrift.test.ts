import {describe, expect, it} from 'vitest';
import {detectLocaleDrift} from '@services/features/Bundle/BundleService';

describe('detectLocaleDrift', () => {
    it('returns empty array when every bundle symbol is in the configured locales', () => {
        const drift = detectLocaleDrift(
            [{symbol: 'en'}, {symbol: 'lv'}],
            ['en', 'lv', 'ru'],
        );
        expect(drift).toEqual([]);
    });

    it('returns the symbols present in the bundle but missing from config', () => {
        const drift = detectLocaleDrift(
            [{symbol: 'en'}, {symbol: 'lt'}, {symbol: 'it'}],
            ['en', 'lv'],
        );
        expect(drift.sort()).toEqual(['it', 'lt']);
    });

    it('ignores duplicate symbols in the bundle (each drift listed once)', () => {
        const drift = detectLocaleDrift(
            [{symbol: 'lt'}, {symbol: 'lt'}, {symbol: 'lt'}],
            ['en'],
        );
        expect(drift).toEqual(['lt']);
    });

    it('skips rows with missing / empty symbol', () => {
        const drift = detectLocaleDrift(
            [{symbol: ''}, {}, {symbol: 'lt'}],
            ['en'],
        );
        expect(drift).toEqual(['lt']);
    });

    it('returns empty when bundle is empty', () => {
        expect(detectLocaleDrift([], ['en', 'lv'])).toEqual([]);
    });

    it('returns empty when configLocales omitted and the runtime config can be read', () => {
        // Live config has 'en' + 'lv' at minimum (per the canonical
        // next-i18next.config.js shipped with the repo); both should
        // suffice for the no-drift case here.
        expect(detectLocaleDrift([{symbol: 'en'}])).toEqual([]);
    });

    it('trims whitespace before comparing', () => {
        const drift = detectLocaleDrift(
            [{symbol: '  lt  '}],
            ['en', 'lv'],
        );
        expect(drift).toEqual(['lt']);
    });
});
