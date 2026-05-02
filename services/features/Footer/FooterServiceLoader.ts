import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {FooterService} from './FooterService';

/**
 * Footer Loader — Class Loader L3 migration of `footerFeature`.
 * Owns `FooterService` (a SiteSettings key). Single-arg ctor, no indexes.
 */
export class FooterServiceLoader extends ServiceLoader {
    readonly id = 'footer';
    readonly displayName = 'Footer';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {footer: new FooterService(ctx.db)};
    }

    readonly schemaSDL = `extend type QueryMongo {
    getFooter: String!
}
extend type MutationMongo {
    saveFooter(config: JSON!, expectedVersion: Int): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            saveFooter: 'editor',
        },
        sessionInjected: ['saveFooter'],
    };
}
