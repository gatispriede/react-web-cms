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

// ──────────────────────────────────────────────────────────────────────
// Q10 — three orthogonal grant dimensions composable on a user.
// Per `docs/features/platform/edit-levels.md` (2026-05-03).
//
//   - `{kind:'feature'}` — user can mutate that feature
//   - `{kind:'page'}`    — user can edit that specific page slug
//   - `{kind:'locale'}`  — user can edit/translate that language
//
// A mutation declares which dimensions it is gated on; the gate
// composes by intersection — for every declared dimension the user must
// hold a matching grant (or be `admin` rank, which always passes).
// ──────────────────────────────────────────────────────────────────────

export type GrantDimension = 'feature' | 'page' | 'locale';

export interface FeatureGrant { kind: 'feature'; feature: string; }
export interface PageGrant    { kind: 'page';    page: string;    }
export interface LocaleGrant  { kind: 'locale';  locale: string;  }

export type Grant = FeatureGrant | PageGrant | LocaleGrant;

/** Shape extractors return when declaring `resourceGated` on a manifest. */
export interface DimensionGrantSpec {
    feature?: string;
    page?: string;
    locale?: string;
}

/**
 * Predicate: does the user hold a grant matching `(dimension, value)`?
 * Admin rank short-circuits to `true` — the role-rank check happens at
 * the call site (PermissionService / authz), this helper is the pure
 * grant-array lookup.
 */
export function userHasGrant(
    grants: readonly Grant[] | undefined,
    dimension: GrantDimension,
    value: string,
): boolean {
    if (!grants || grants.length === 0) return false;
    for (const g of grants) {
        if (g.kind !== dimension) continue;
        if (dimension === 'feature' && (g as FeatureGrant).feature === value) return true;
        if (dimension === 'page'    && (g as PageGrant).page       === value) return true;
        if (dimension === 'locale'  && (g as LocaleGrant).locale   === value) return true;
    }
    return false;
}
