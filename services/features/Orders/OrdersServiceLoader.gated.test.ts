import {describe, expect, it} from 'vitest';
import {ordersFeature} from '@services/features/Orders/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('ordersFeature — Q10 resourceGated', () => {
    it('declares feature-dimension gates on admin order-state mutations only', () => {
        const gated = ordersFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(
            ['adminRefundOrder', 'adminTransitionOrder'],
        );
        const out = (gated.adminTransitionOrder as ResourceGateExtractor)({});
        expect(out).toMatchObject({
            dimensions: ['feature'],
            values: {feature: 'Orders'},
        });
    });

    it('does NOT gate customer-facing checkout-flow mutations', () => {
        const gated = ordersFeature.authz?.resourceGated ?? {};
        expect(gated.createDraftOrder).toBeUndefined();
        expect(gated.finalizeOrder).toBeUndefined();
    });
});
