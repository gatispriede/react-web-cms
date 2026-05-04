import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {AssetService} from './AssetService';

/**
 * Assets Loader — Class Loader L3 migration of `assetsFeature`.
 * Owns `AssetService` (Logos + Images collections). Two-collection ctor +
 * `reconnect` (read off `ctx.reconnect`).
 */
export class AssetsServiceLoader extends ServiceLoader {
    readonly id = 'assets';
    readonly displayName = 'Assets';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            assets: new AssetService(ctx.db.collection('Logos'), ctx.db.collection('Images'), ctx.reconnect),
        };
    }

    readonly schemaSDL = `extend type QueryMongo {
    getImages(tags: String!): [IImage!]!
    getLogo: ILogo
}
extend type MutationMongo {
    saveImage(image: InImage!): String!
    deleteImage(id: String!): String!
    saveLogo(content: String!, expectedVersion: Int): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            saveImage: 'editor',
            deleteImage: 'editor',
            saveLogo: 'editor',
        },
        sessionInjected: ['saveLogo'],
    };
}
