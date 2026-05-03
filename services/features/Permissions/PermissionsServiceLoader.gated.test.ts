import {describe, expect, it} from 'vitest';
import {permissionsFeature} from '@services/features/Permissions/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('permissionsFeature — Q10 resourceGated', () => {
    it('declares feature-dim gates on grantPermission and revokePermission', () => {
        const gated = permissionsFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(['grantPermission', 'revokePermission']);

        const grant = (gated.grantPermission as ResourceGateExtractor)({userId: 'u', scope: 's', resourceId: 'r'});
        expect(grant).toMatchObject({dimensions: ['feature'], values: {feature: 'Permissions'}});

        const revoke = (gated.revokePermission as ResourceGateExtractor)({userId: 'u', scope: 's', resourceId: 'r'});
        expect(revoke).toMatchObject({dimensions: ['feature'], values: {feature: 'Permissions'}});
    });
});
