import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {AnyCascadeRule, FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {RedirectsService} from './RedirectsService';
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
            // W8h SEO program — operator-editable redirect table.
            // Consumed by `ui/client/middleware.ts` before route resolution.
            redirects: new RedirectsService(ctx.db),
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
        // Q10 — SEO + site flags are site-wide singletons. Feature dim only.
        // `saveSiteFlags` is admin-rank already; the gate is a forward-compat
        // hook for a future `flags-manager` functional role.
        resourceGated: {
            saveSiteFlags: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Seo'},
            }),
            saveSiteSeo: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Seo'},
            }),
        },
    };

    /**
     * Cascade — when a Navigation row is deleted, drop the matching
     * `pages.<slug>` key from the singleton SiteSeo doc
     * (`SiteSettings(key=siteSeo).value.pages.<slug>`). Per-page SEO
     * lives keyed inside the singleton, so a doc-mutate rule is the
     * correct shape (vs. a collection-row move).
     *
     * IMPORTANT: doc-mutate rules are one-way. `cascadeRestore` does
     * NOT re-instate the SiteSeo entry when the Navigation row is
     * restored — singletons have no clean restore semantic. Editors
     * must re-enter the per-page SEO if they undo a delete.
     */
    readonly cascadeRules: readonly AnyCascadeRule[] = [
        {
            kind: 'doc-mutate',
            parentFeature: 'navigation',
            parentCollection: 'Navigation',
            targetCollection: 'SiteSettings',
            targetFilter: {key: 'siteSeo'},
            buildUpdate: (_parentId: string, parentDoc?: any) => {
                const slug = parentDoc?.slug ?? parentDoc?.page;
                if (!slug || typeof slug !== 'string') {
                    // Nothing to unset — return a no-op `$set` so Mongo
                    // doesn't reject an empty update.
                    return {$set: {key: 'siteSeo'}};
                }
                return {$unset: {[`pages.${slug}`]: ''}};
            },
        },
    ];
}
