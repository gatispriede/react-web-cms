import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {SiteFlagsService} from './SiteFlagsService';
import {SiteSeoService} from './SiteSeoService';

/**
 * SEO Loader — Class Loader L3 migration of `seoFeature`.
 *
 * Owns BOTH services that share the `Seo/` folder. Both are SiteSettings-
 * keyed, tightly related, exposed under their own keys on `featureServices`.
 */
export class SeoServiceLoader extends ServiceLoader {
    readonly id = 'seo';
    readonly displayName = 'SEO & site flags';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            siteFlags: new SiteFlagsService(ctx.db),
            siteSeo: new SiteSeoService(ctx.db),
        };
    }

    readonly schemaSDL = `extend type QueryMongo {
    getSiteFlags: String!
    getSiteSeo: String!
}
extend type MutationMongo {
    saveSiteFlags(flags: JSON!, expectedVersion: Int): String!
    saveSiteSeo(seo: JSON!, expectedVersion: Int): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            saveSiteFlags: 'admin',
            saveSiteSeo: 'editor',
        },
        sessionInjected: [
            'saveSiteFlags',
            'saveSiteSeo',
        ],
    };
}
