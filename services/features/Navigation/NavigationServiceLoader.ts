import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {CascadeRule, FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
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
    removeSectionItem(id:String!, idempotencyKey: String): String!
    deleteNavigationItem(pageName:String!, idempotencyKey: String): String!
    setParent(pageId: String!, parentId: String): String!
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
            setParent: 'editor',
        },
        sessionInjected: [
            'addUpdateSectionItem',
            'updateNavigation',
            'replaceUpdateNavigation',
            'addUpdateNavigationItem',
            'deleteNavigationItem',
            'removeSectionItem',
            'setParent',
        ],
        // Q10 — Navigation owns Pages + Sections. Mutations carrying a
        // pageName/page slug gate on `{feature, page}`; cross-page or
        // id-only mutations gate on `{feature}` (admin rank or a
        // Navigation-feature grant suffices).
        resourceGated: {
            createNavigation: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Navigation'},
            }),
            addUpdateNavigationItem: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Navigation', page: args?.pageName ?? ''},
            }),
            updateNavigation: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Navigation', page: args?.page ?? ''},
            }),
            replaceUpdateNavigation: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Navigation', page: args?.oldPageName ?? ''},
            }),
            addUpdateSectionItem: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Navigation', page: args?.pageName ?? ''},
            }),
            removeSectionItem: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Navigation'},
            }),
            deleteNavigationItem: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Navigation', page: args?.pageName ?? ''},
            }),
            // F1 sub-pages — `setParent` operates on a single page by id.
            // Gate on `{feature, page}` where `page = args.pageId` so a
            // page-scoped grant is sufficient (matches the per-page
            // gating used elsewhere in the manifest).
            setParent: (args: any) => ({
                dimensions: ['feature', 'page'] as const,
                values: {feature: 'Navigation', page: args?.pageId ?? ''},
            }),
        },
    };

    /**
     * `page-owner` functional role — assignable, scopes the user to
     * page-level edits across pages they've been granted. Per
     * `docs/features/platform/edit-levels.md` (decision 4).
     */
    /**
     * Cascade rules — Navigation owns both `Navigation` and `Sections`,
     * so the rule lives here (the spec's "rule lives with the child"
     * convention collapses to "lives here" when one feature owns
     * both). Deleting a Navigation row cascades to every Section it
     * pointed at via `nav.sections`.
     */
    readonly cascadeRules: readonly CascadeRule[] = [
        {
            parentFeature: 'navigation',
            parentCollection: 'Navigation',
            childCollection: 'Sections',
            matchByParentId: (_parentId: string, parentDoc?: any) => ({
                id: {$in: (parentDoc?.sections ?? []) as string[]},
            }),
        },
        // Sub-pages: Navigation rows whose `parent` field references the
        // deleted page should follow it into trash. The cascade engine
        // recurses (depth-bounded by MAX_DEPTH) so grandchildren are
        // discovered as their parent rows are moved.
        {
            parentFeature: 'navigation',
            parentCollection: 'Navigation',
            childCollection: 'Navigation',
            matchByParentId: (_parentId: string, parentDoc?: any) => ({
                parent: parentDoc?.id,
            }),
        },
    ];

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
