import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {PublishService} from './PublishService';

/**
 * Publishing Loader — Class Loader L3 migration of `publishingFeature`.
 * Owns `PublishService` (PublishedSnapshots + rollback).
 */
export class PublishingServiceLoader extends ServiceLoader {
    readonly id = 'publishing';
    readonly displayName = 'Publishing';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {publish: new PublishService(ctx.db)};
    }

    readonly schemaSDL = `extend type QueryMongo {
    getPublishedSnapshot: String
    getPublishedMeta: String
    getPublishedHistory(limit: Int): String!
}
extend type MutationMongo {
    publishSnapshot(note: String): String!
    rollbackToSnapshot(id: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            publishSnapshot: 'editor',
            rollbackToSnapshot: 'editor',
        },
        sessionInjected: [
            'publishSnapshot',
            'rollbackToSnapshot',
        ],
        capabilities: {
            publishSnapshot: 'canPublishProduction',
            rollbackToSnapshot: 'canPublishProduction',
        },
    };
}
