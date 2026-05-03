import {describe, expect, it} from 'vitest';
import {usersFeature} from '@services/features/Users/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('usersFeature — Q10 resourceGated', () => {
    it('gates admin-rank user-management mutations on the feature dimension', () => {
        const gated = usersFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(['addUser', 'removeUser', 'updateUser']);

        for (const key of ['addUser', 'updateUser', 'removeUser'] as const) {
            const out = (gated[key] as ResourceGateExtractor)({});
            expect(out).toMatchObject({dimensions: ['feature'], values: {feature: 'Users'}});
        }
    });

    it('does NOT gate setMyAdminUiMode (self-service over the caller row)', () => {
        const gated = usersFeature.authz?.resourceGated ?? {};
        expect(gated.setMyAdminUiMode).toBeUndefined();
    });
});
