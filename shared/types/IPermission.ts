/**
 * Edit-levels — `Permissions` collection rows + functional-role types.
 * Per `docs/features/platform/edit-levels.md` (decisions 2026-05-02).
 */

/** Resource scope for edit grants. */
export type PermissionScope = 'page' | 'module' | 'element';

/**
 * One row per (user, resource) grant. Levels are independent — page-edit
 * on /about does NOT imply module-edit on its sections (decision 2).
 */
export interface IPermission {
    id: string;
    userId: string;
    scope: PermissionScope;
    /**
     * Stable resource id matching the underlying record:
     *   - `Sections.id` for module instances
     *   - `Navigation.page` (the slug) for page-level grants
     *   - free-form for element-level grants (translation key, etc.)
     */
    resourceId: string;
    grantedBy: string;
    grantedAt: string;
}

/**
 * Functional-role descriptor — declared on a `ServiceLoader` (or
 * `UILoader`) so the role lives next to the feature it concerns.
 * Decision 4 (2026-05-02): permissions are expressed as functional
 * roles where each role declares its own responsibility surface.
 *
 *   class LanguagesServiceLoader extends ServiceLoader {
 *       readonly functionalRoles: readonly FunctionalRoleDescriptor[] = [
 *           {
 *               id: 'translator',
 *               displayName: 'Translator',
 *               assignable: true,
 *               grants: { translations: 'edit', everything-else: 'read-only' },
 *           },
 *       ];
 *   }
 *
 * Discovery defaults to internal-only — only `assignable: true` roles
 * surface in the admin "assign roles" picker (decision 7).
 */
export interface FunctionalRoleDescriptor {
    /** Stable id — referenced in `IUser.functionalRoles[]`. */
    id: string;
    /** Human-readable label for the admin picker. */
    displayName: string;
    /** When `true`, surfaces in the admin "assign roles" UI. Default `false`. */
    assignable?: boolean;
    /**
     * Free-form grant map — the role's resolver inspects this to decide
     * what the role can touch. Convention is open: features can define
     * their own keys (`translations: 'edit' | 'read'`, `posts: 'publish' | 'edit'`,
     * etc.). The `PermissionService.can()` predicate ultimately calls a
     * loader-supplied checker; this map is a hint surface for the admin UI.
     */
    grants: Readonly<Record<string, string>>;
}

/** What `IUser.functionalRoles` stores — by-id reference. */
export interface IUserFunctionalRoles {
    /** Functional role ids the user has been assigned. */
    functionalRoles?: readonly string[];
}
