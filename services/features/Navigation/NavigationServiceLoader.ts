import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import type {FunctionalRoleDescriptor} from '@interfaces/IPermission';
import {NavigationService} from './NavigationService';
import {log} from '@services/infra/logger';

/**
 * Navigation Loader — Class Loader L3 migration of `navigationFeature`.
 *
 * Owns `NavigationService` (Navigation + Sections collections). Ctor
 * takes TWO collections + a `reconnect` callback (read off `ctx.reconnect`).
 *
 * `onBoot` runs the legacy ghost-navigation visibility check — read-only
 * count + a log line, idempotent, safe to run every boot.
 */
export class NavigationServiceLoader extends ServiceLoader {
    readonly id = 'navigation';
    readonly displayName = 'Navigation';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            navigation: new NavigationService(
                ctx.db.collection('Navigation'),
                ctx.db.collection('Sections'),
                ctx.reconnect,
            ),
        };
    }

    readonly schemaSDL = `extend type QueryMongo {
    getNavigationCollection: [INavigation!]!
    getSections(ids: [String]): [ISection!]!
}
extend type MutationMongo {
    createNavigation(navigation: InNavigation!): String!
    addUpdateNavigationItem(pageName: String!, sections: [String]): String!
    updateNavigation(page: String!, sections: [String]): String!
    replaceUpdateNavigation(oldPageName: String!,navigation: InNavigation): String!
    addUpdateSectionItem(section: InSection!, pageName: String, expectedVersion: Int): String!
    removeSectionItem(id:String!): String!
    deleteNavigationItem(pageName:String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            createNavigation: 'editor',
            addUpdateNavigationItem: 'editor',
            updateNavigation: 'editor',
            replaceUpdateNavigation: 'editor',
            addUpdateSectionItem: 'editor',
            removeSectionItem: 'editor',
            deleteNavigationItem: 'editor',
        },
        sessionInjected: [
            'addUpdateSectionItem',
            'updateNavigation',
            'replaceUpdateNavigation',
            'addUpdateNavigationItem',
            'deleteNavigationItem',
            'removeSectionItem',
        ],
    };

    /**
     * `page-owner` functional role — assignable, scopes the user to
     * page-level edits across pages they've been granted. Per
     * `docs/features/platform/edit-levels.md` (decision 4).
     */
    readonly functionalRoles: readonly FunctionalRoleDescriptor[] = [
        {
            id: 'page-owner',
            displayName: 'Page owner',
            assignable: true,
            grants: {
                pages: 'edit-own',
                modules: 'edit-on-own-pages',
            },
        },
    ];

    async onBoot(ctx: FeatureContext): Promise<void> {
        // One-shot visibility check for legacy "ghost" Navigation docs.
        try {
            const count = await ctx.db.collection('Navigation').countDocuments({type: {$ne: 'navigation'}});
            if (count > 0) {
                log.warn(
                    {scope: 'cleanup.ghostNav', count},
                    'ghost Navigation docs detected. Run: npx tsx --tsconfig services/tsconfig.custom.json tools/scripts/cleanup-ghost-navigation.ts --apply',
                );
            }
        } catch (err) {
            log.error({scope: 'cleanup.ghostNav', err}, 'ghost-navigation check failed');
        }
    }
}
