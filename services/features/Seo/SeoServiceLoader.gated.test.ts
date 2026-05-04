import {describe, expect, it} from 'vitest';
import {seoFeature} from '@services/features/Seo/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('seoFeature — Q10 resourceGated', () => {
    it('declares feature-dim gates on saveSiteFlags and saveSiteSeo', () => {
        const gated = seoFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(['saveSiteFlags', 'saveSiteSeo']);

        const flags = (gated.saveSiteFlags as ResourceGateExtractor)({});
        expect(flags).toMatchObject({dimensions: ['feature'], values: {feature: 'Seo'}});

        const seo = (gated.saveSiteSeo as ResourceGateExtractor)({});
        expect(seo).toMatchObject({dimensions: ['feature'], values: {feature: 'Seo'}});
    });
});
