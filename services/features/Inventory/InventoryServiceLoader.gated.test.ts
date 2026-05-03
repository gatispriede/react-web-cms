import {describe, expect, it} from 'vitest';
import {inventoryFeature} from '@services/features/Inventory/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('inventoryFeature — Q10 resourceGated', () => {
    it('declares feature-dimension gates on the three inventory mutations', () => {
        const gated = inventoryFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(
            ['inventorySaveAdapterConfig', 'inventorySyncAll', 'inventorySyncDelta'],
        );
        const out = (gated.inventorySyncAll as ResourceGateExtractor)({});
        expect(out).toMatchObject({
            dimensions: ['feature'],
            values: {feature: 'Inventory'},
        });
    });
});
