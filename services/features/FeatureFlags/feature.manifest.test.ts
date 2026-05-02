import {describe, it, expect} from 'vitest';
import {featureFlagsFeature} from './feature.manifest';
import {FeatureFlagsService} from './FeatureFlagsService';

describe('featureFlagsFeature manifest', () => {
    it('has the expected id + displayName + core lock', () => {
        expect(featureFlagsFeature.id).toBe('featureFlags');
        expect(featureFlagsFeature.displayName).toMatch(/feature/i);
        expect(featureFlagsFeature.coreInfrastructure).toBe(true);
    });

    it('builds a FeatureFlagsService keyed as `featureFlags`', () => {
        const fakeDb = {collection: () => ({createIndex: async () => undefined})};
        const built = featureFlagsFeature.services!({
            db: fakeDb as any,
            redis: {} as any,
            services: {},
            reconnect: async () => {},
        });
        expect(built.featureFlags).toBeInstanceOf(FeatureFlagsService);
    });

    it('contributes setFeatureFlag + clearFeatureFlag SDL', () => {
        expect(featureFlagsFeature.schemaSDL).toContain('setFeatureFlag(id: String!, enabled: Boolean!): String!');
        expect(featureFlagsFeature.schemaSDL).toContain('clearFeatureFlag(id: String!): String!');
    });

    it('gates both mutations to admin + injects session', () => {
        expect(featureFlagsFeature.authz?.mutationRequirements?.setFeatureFlag).toBe('admin');
        expect(featureFlagsFeature.authz?.mutationRequirements?.clearFeatureFlag).toBe('admin');
        expect(featureFlagsFeature.authz?.sessionInjected).toContain('setFeatureFlag');
        expect(featureFlagsFeature.authz?.sessionInjected).toContain('clearFeatureFlag');
    });
});
