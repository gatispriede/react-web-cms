import {describe, expect, it} from 'vitest';
import {footerFeature} from '@services/features/Footer/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('footerFeature — Q10 resourceGated', () => {
    it('declares a feature-dimension gate on saveFooter', () => {
        const gated = footerFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated)).toEqual(['saveFooter']);
        const out = (gated.saveFooter as ResourceGateExtractor)({});
        expect(out).toMatchObject({
            dimensions: ['feature'],
            values: {feature: 'Footer'},
        });
    });
});
