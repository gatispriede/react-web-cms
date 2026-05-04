import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {FeatureFlagsService} from './FeatureFlagsService';
import {primeFeatureFlagCache} from '@services/infra/featureFlags';

/**
 * FeatureFlags Loader — Class Loader L3 migration of `featureFlagsFeature`.
 * Owns the Mongo `FeatureFlags` collection that persists admin/MCP
 * overrides for plug-and-play toggles.
 *
 * Always on (`coreInfrastructure: true`) — disabling the flag store
 * would lock the operator out of toggling any other feature.
 */
export class FeatureFlagsServiceLoader extends ServiceLoader {
    readonly id = 'featureFlags';
    readonly displayName = 'Feature flags (plug-and-play store)';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {featureFlags: new FeatureFlagsService(ctx.db)};
    }

    async onBoot(ctx: FeatureContext): Promise<void> {
        const svc = ctx.services.featureFlags as FeatureFlagsService;
        const rows = await svc.listAll();
        primeFeatureFlagCache(rows);
    }

    readonly schemaSDL = `extend type MutationMongo {
    """Persist a plug-and-play feature toggle override. Returns JSON {id, enabled, updatedAt, updatedBy}."""
    setFeatureFlag(id: String!, enabled: Boolean!): String!
    """Drop a feature toggle override; the feature falls back to its default behaviour."""
    clearFeatureFlag(id: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            setFeatureFlag: 'admin',
            clearFeatureFlag: 'admin',
        },
        sessionInjected: [
            'setFeatureFlag',
            'clearFeatureFlag',
        ],
    };
}
