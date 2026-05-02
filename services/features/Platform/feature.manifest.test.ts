import {describe, it, expect} from 'vitest';
import {platformFeature} from './feature.manifest';

describe('platformFeature manifest', () => {
    it('declares the right id + displayName + core flag', () => {
        expect(platformFeature.id).toBe('platform');
        expect(platformFeature.displayName).toMatch(/platform/i);
        expect(platformFeature.coreInfrastructure).toBe(true);
    });

    it('contributes the three platform queries via SDL', () => {
        expect(platformFeature.schemaSDL).toContain('extend type QueryMongo');
        expect(platformFeature.schemaSDL).toContain('getMongoDBUri');
        expect(platformFeature.schemaSDL).toContain('loadData');
        expect(platformFeature.schemaSDL).toContain('getFeatureFlags');
    });

    it('gates all three at admin level', () => {
        expect(platformFeature.authz?.queryRequirements?.getMongoDBUri).toBe('admin');
        expect(platformFeature.authz?.queryRequirements?.loadData).toBe('admin');
        expect(platformFeature.authz?.queryRequirements?.getFeatureFlags).toBe('admin');
    });

    it('contributes no services — pure SDL/authz ownership', () => {
        expect(platformFeature.services).toBeUndefined();
        expect(platformFeature.indexes).toBeUndefined();
        expect(platformFeature.resolvers).toBeUndefined();
    });
});
