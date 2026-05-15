/**
 * 4-tier permission UX → granular `(scope, resourceId)` grants.
 *
 * Per `docs/roadmap/admin/admin-permissions-ux.md` — the underlying
 * `PermissionService` rows are keyed on `(userId, scope, resourceId)`.
 * This module is the **operator-readable source of truth** for what
 * each tier expands to in the existing engine. When ops ask "what can
 * Editor do on Pages?" they read this file.
 *
 * Tiers (semantic):
 *   - Full    — engine grant for the entire collection + admin rank for
 *               publish / delete. Today: grant row with `resourceId:'*'`
 *               + `canPublishProduction: true` for the relevant scope.
 *   - Edit    — grant row with `resourceId:'*'` on the collection scope.
 *   - Comment — placeholder; behaves like View today (no comment feature
 *               shipped yet). Reserved tier slot for the eventual
 *               review / approval flow.
 *   - View    — no grant rows; queries are open by default per the
 *               edit-levels spec (decisions 2026-05-02).
 *
 * Scopes map onto the existing `PermissionScope` enum
 * (`'page' | 'module' | 'element'`). UX-level collection names
 * (Pages / Posts / Products / etc.) collapse onto these — Pages and
 * Posts both surface as `scope:'page'` rows backed by the underlying
 * Navigation collection because the engine doesn't yet split them.
 */

import {PermissionScope} from '@interfaces/IPermission';

/** Tier names — user-visible labels live in i18n. */
export type Tier = 'Full' | 'Edit' | 'Comment' | 'View';

export const TIER_ORDER: readonly Tier[] = ['Full', 'Edit', 'Comment', 'View'];

/**
 * UX-level scope keys. Each maps to one or more engine `PermissionScope`
 * rows. Single-mode-of-truth lookup so the editor renders the same labels
 * the MCP tools speak.
 */
export type ScopeKey =
    | 'Pages'
    | 'Posts'
    | 'Products'
    | 'Themes'
    | 'Orders'
    | 'Customers'
    | 'Settings';

export const SCOPE_ORDER: readonly ScopeKey[] = [
    'Pages', 'Posts', 'Products', 'Themes', 'Orders', 'Customers', 'Settings',
];

/**
 * Engine-side grant a tier expands into. `resourceId:'*'` is the
 * collection-wide marker — a single row covers every resource in the
 * scope. Per-resource overrides write additional rows keyed on the
 * specific id and the resolver prefers the more specific row.
 */
export interface GrantSpec {
    scope: PermissionScope;
    resourceId: string;
}

/** Whether a tier sets `canPublishProduction` on the user. */
export function tierGrantsPublish(tier: Tier): boolean {
    return tier === 'Full';
}

/**
 * Expand a (scope, tier) to the concrete `(scope, resourceId)` rows
 * the engine writes. Empty array means "no rows needed" — View and
 * Comment fall through to the open-queries baseline.
 */
export function tierToGrants(scopeKey: ScopeKey, tier: Tier): GrantSpec[] {
    if (tier === 'View' || tier === 'Comment') return [];
    // Full + Edit both grant collection-wide write access today. Full
    // additionally toggles `canPublishProduction` (handled by the caller).
    const engineScope = mapScopeKeyToEngineScope(scopeKey);
    if (!engineScope) return [];
    return [{scope: engineScope, resourceId: '*'}];
}

/**
 * Inverse — given engine rows for a user, infer the tier the UX should
 * show per scope. Used when opening the editor on an existing user.
 */
export function inferTierFromGrants(
    scopeKey: ScopeKey,
    grants: ReadonlyArray<{scope: string; resourceId: string}>,
    canPublishProduction: boolean,
): Tier {
    const engineScope = mapScopeKeyToEngineScope(scopeKey);
    if (!engineScope) return 'View';
    const wildcardRow = grants.find(g => g.scope === engineScope && g.resourceId === '*');
    if (!wildcardRow) return 'View';
    return canPublishProduction ? 'Full' : 'Edit';
}

// ──────────────────────────────────────────────────────────────────────
// Grant-grid editor — feature / page / locale dimension grants.
//
// Per `docs/roadmap/admin/admin-permissions-ux.md` the grant-grid is the
// richer UX for the Q10 three-dimension `Grant` union
// (`shared/types/IPermission.ts`). The engine `Permissions` collection
// keys rows on `(userId, scope, resourceId)` and the GraphQL
// `grantPermission` mutation accepts an arbitrary `scope` string — so the
// three grant dimensions persist as engine rows under reserved scope
// names. This block is the operator-readable source of truth for that
// encoding: a `feature` grant on `Posts` is the engine row
// `(scope:'feature', resourceId:'Posts')`, and so on.
// ──────────────────────────────────────────────────────────────────────

/** The three Q10 grant dimensions, in display order. */
export type GrantDimension = 'feature' | 'page' | 'locale';

export const GRANT_DIMENSIONS: readonly GrantDimension[] = ['feature', 'page', 'locale'];

/**
 * Engine `scope` string a grant dimension persists under. Reserved
 * scope names (`feature` / `page` / `locale`) sit alongside the
 * `page | module | element` resource scopes — the resolver keys on the
 * string exactly, so the namespaces don't collide as long as the grid
 * always writes the reserved names.
 */
export function grantScopeFor(dimension: GrantDimension): string {
    // The dimension name *is* the engine scope string — kept as a
    // function so callers don't hard-code the convention.
    return dimension;
}

/** Inverse of `grantScopeFor` — `undefined` for non-grant-grid scopes. */
export function dimensionFromScope(scope: string): GrantDimension | undefined {
    return (GRANT_DIMENSIONS as readonly string[]).includes(scope)
        ? (scope as GrantDimension)
        : undefined;
}

/**
 * Map UX scope (Pages, Posts, …) → engine `PermissionScope`. Today the
 * engine only splits on `page | module | element`; UX-level scopes are
 * aliased onto those. Returns `undefined` for scopes that don't map
 * (Settings / Customers are role-rank gated, not row-gated).
 */
function mapScopeKeyToEngineScope(scopeKey: ScopeKey): PermissionScope | undefined {
    switch (scopeKey) {
        case 'Pages':
        case 'Posts':
            return 'page';
        case 'Products':
            return 'module';
        case 'Themes':
            return 'element';
        case 'Orders':
        case 'Customers':
        case 'Settings':
            // Role-rank gated, not row-gated. Tier still shown in UI;
            // saving these is a no-op against the rows table.
            return undefined;
    }
}
