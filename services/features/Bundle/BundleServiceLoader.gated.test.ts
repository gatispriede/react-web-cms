import {describe, expect, it} from 'vitest';
import {bundleFeature} from '@services/features/Bundle/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('bundleFeature — Q10 resourceGated', () => {
    it('declares feature-dimension gates on import / export', () => {
        const gated = bundleFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(['export', 'import', 'restoreFromTrash']);
        const out = (gated.import as ResourceGateExtractor)({});
        expect(out).toMatchObject({
            dimensions: ['feature'],
            values: {feature: 'Bundle'},
        });
    });
});
