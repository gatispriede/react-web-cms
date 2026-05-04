import {describe, expect, it} from 'vitest';
import {languagesFeature} from '@services/features/Languages/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('languagesFeature — Q10 resourceGated', () => {
    it('declares {feature, locale} gates on per-language mutations and feature-only on meta', () => {
        const gated = languagesFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(
            ['addUpdateLanguage', 'deleteLanguage', 'saveTranslationMeta'],
        );

        const add = (gated.addUpdateLanguage as ResourceGateExtractor)({language: {symbol: 'lv'}});
        expect(add).toMatchObject({
            dimensions: ['feature', 'locale'],
            values: {feature: 'Languages', locale: 'lv'},
        });

        const del = (gated.deleteLanguage as ResourceGateExtractor)({language: {symbol: 'en'}});
        expect(del).toMatchObject({
            dimensions: ['feature', 'locale'],
            values: {feature: 'Languages', locale: 'en'},
        });

        const meta = (gated.saveTranslationMeta as ResourceGateExtractor)({});
        expect(meta).toMatchObject({
            dimensions: ['feature'],
            values: {feature: 'Languages'},
        });
    });
});
