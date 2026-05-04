import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution} from '@services/infra/featureManifest';

/**
 * Platform Loader — Class Loader L3 migration of `platformFeature`.
 *
 * Owns the cross-cutting admin/operator queries that don't belong to any
 * single domain feature: feature-flag visibility, Mongo URI lookup, raw
 * `loadData` introspection. No services — every owned query is implemented
 * as a delegate method directly on `MongoDBConnection`. The loader exists
 * purely to assign authz + SDL ownership.
 */
export class PlatformServiceLoader extends ServiceLoader {
    readonly id = 'platform';
    readonly displayName = 'Platform (admin operator queries)';
    readonly coreInfrastructure = true;

    readonly schemaSDL = `extend type QueryMongo {
    """Resolved MongoDB URI — admin-only, surfaces the active connection string for ops introspection."""
    getMongoDBUri: String
    """Mongo \`listDatabases\` projection — sizing + names for the operator dashboard."""
    loadData: [ILoadData!]!
    """Plug-and-play feature flags — runtime view of which feature manifests are active."""
    getFeatureFlags: String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            getMongoDBUri: 'admin',
            loadData: 'admin',
            getFeatureFlags: 'admin',
        },
    };
}
