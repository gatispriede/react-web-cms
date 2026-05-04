import {describe, expect, it} from 'vitest';
import {productsFeature} from '@services/features/Products/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('productsFeature — Q10 resourceGated', () => {
    it('declares feature-dimension gates on saveProduct / deleteProduct / setProductPublished', () => {
        const gated = productsFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(
            ['deleteProduct', 'saveProduct', 'setProductPublished'],
        );
        const out = (gated.saveProduct as ResourceGateExtractor)({});
        expect(out).toMatchObject({
            dimensions: ['feature'],
            values: {feature: 'Products'},
        });
    });
});
