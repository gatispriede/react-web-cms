import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {CascadeRule, FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {PermissionService} from './PermissionService';

/**
 * Permissions Loader — owns the `Permissions` collection. Always on
 * (`coreInfrastructure: true`) because the auth layer depends on it
 * once `guardMethods` gains the per-resource hook (follow-up).
 *
 * Per `docs/features/platform/edit-levels.md` (decisions 2026-05-02):
 * resource-scoped grants overlay on top of rank role + functional roles.
 */
export class PermissionsServiceLoader extends ServiceLoader {
    readonly id = 'permissions';
    readonly displayName = 'Permissions (resource-scoped grants)';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {permissions: new PermissionService(ctx.db)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        // Natural-key uniqueness — one row per (user, scope, resourceId).
        // Lookups in `can()` hit this index too.
        {
            collection: 'Permissions',
            spec: {userId: 1, scope: 1, resourceId: 1},
            options: {unique: true},
        },
        // "All grants for resource X" — used by the future admin
        // "who has access to this page" surface.
        {collection: 'Permissions', spec: {scope: 1, resourceId: 1}},
    ];

    readonly schemaSDL = `extend type QueryMongo {
    """Admin — list every permission grant for a user."""
    permissionsForUser(userId: String!): String!
    """Read — list of functional roles declared by every active feature, with assignable flag."""
    functionalRoles: String!
}
extend type MutationMongo {
    """Admin — grant a (user, scope, resourceId) permission. Idempotent."""
    grantPermission(userId: String!, scope: String!, resourceId: String!): String!
    """Admin — revoke a (user, scope, resourceId) permission."""
    revokePermission(userId: String!, scope: String!, resourceId: String!, idempotencyKey: String): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            permissionsForUser: 'admin',
            functionalRoles: 'editor',
        },
        mutationRequirements: {
            grantPermission: 'admin',
            revokePermission: 'admin',
        },
        sessionInjected: [
            'grantPermission',
            'revokePermission',
        ],
        // Q10 — admin-rank already; feature gate is a forward-compat hook
        // for a future `permissions-manager` functional role.
        resourceGated: {
            grantPermission: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Permissions'},
            }),
            revokePermission: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Permissions'},
            }),
        },
    };

    /**
     * Cascade — when a Navigation page is deleted, drop every
     * page-scoped permission grant attached to its slug. Lives here
     * (child-owning side) per the convention. The parent doc carries
     * `page` (the slug); resource-scoped grants key off `resourceId`.
     */
    readonly cascadeRules: readonly CascadeRule[] = [
        {
            parentFeature: 'navigation',
            parentCollection: 'Navigation',
            childCollection: 'Permissions',
            matchByParentId: (_parentId: string, parentDoc?: any) => ({
                scope: 'page',
                resourceId: parentDoc?.page,
            }),
        },
    ];
}
