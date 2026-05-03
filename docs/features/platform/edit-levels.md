# Multi-level edit granularity

Status: **Q10 three-dimension grants shipped 2026-05-03.** `userHasGrant` helper + `Grant` discriminated union (`feature` / `page` / `locale`) on `IPermission.ts`; `IUser.grants` carries the user's assignments. `guardMethods` now accepts a `GrantResolver` and enforces dimension intersection (admin rank bypasses). `RESOURCE_GATED_METHODS` extractors may return either the legacy `{scope, resourceId}` shape OR the new `{dimensions, values}` shape; both branches coexist. Posts wired as the reference (`savePost` / `deletePost` / `setPostPublished` gated on `{feature: 'Posts', page: <slug>}`). Admin Users pane gained three multi-select fields persisted to `IUser.grants`. Tests in `services/features/Auth/__tests__/grants.test.ts`.

Status: **Foundation + guardMethods integration shipped 2026-05-02.** `Permissions` feature + Loader, `PermissionService` (CRUD + can() predicate + per-request cache + creator-on-create helper), `FunctionalRoleDescriptor` type carried through Loader → manifest → registry, `composedFunctionalRoles()`, GraphQL surface (`grantPermission` / `revokePermission` / `permissionsForUser` / `functionalRoles`). Three roles declared on their owning Loaders: `translator` (Languages), `content-editor` (Posts), `page-owner` (Navigation). **`guardMethods` extended** with `resourceGated` extractors + `permissionCheck` hook; the next-route mutation proxy reads `RESOURCE_GATED_METHODS` from `composedAuthz` and feeds a request-scoped permission predicate. Features opt in by adding `resourceGated` entries to their manifest's `authz`. **Remaining**: feature-by-feature `resourceGated` declarations on actual mutation methods, admin UI for assigning roles + grants, one-shot migration from `siteFlags.inlineTranslationEdit` → `translator` role.
Last updated: 2026-05-02

## What it is

A unified edit-permission model that lets an operator hand someone "edit this one module" instead of "edit everything." Currently the role rank is `viewer < editor < admin` and an editor can change every page, every module, every theme. We need finer scopes: page-level, module-level, or single-element ("any-edit") permissions, granted as overlays on top of the role.

## The three levels

- **Page** — "you can edit pages X and Y, including all sections within them." Useful for delegating a marketing page to a single content owner.
- **Module** — "you can edit module instance Z (this Hero / Gallery / ProjectGrid block)." Useful for a designer who owns one shared module across pages.
- **Any-edit / element** — "you can edit any single field (a headline, an image alt, a translation key) but not move, delete, or restructure." Maps to the existing inline-translation-edit flag but generalised to *any* rendered text or image.

Each is independent and additive. A user can have page-edit on /about, module-edit on the homepage Hero, and any-edit globally.

## Goals

- Permissions are stored separately from roles — a `Permissions` collection joining user → resource → scope.
- Resource ids are stable across edits (`Sections.id`, `Navigation.page`, `module-instance-id`).
- The existing `guardMethods` proxy gains a per-resource check after the role check passes.
- Admin UI: a "Permissions" pane on the user-edit page shows current grants and lets admin assign/revoke.
- The UI side respects scope too: a user with only any-edit on /about sees the page in read-only mode with inline-edit affordances, not the full section editor.

## Sketch

- New `Permissions` Mongo collection: `{userId, scope: 'page'|'module'|'element', resourceId, grantedBy, grantedAt}`.
- `services/features/Permissions/PermissionService.ts` — list/grant/revoke; `can(userId, scope, resourceId)` predicate.
- `authz.ts` — a new `RESOURCE_GATED_METHODS` map keyed by method name → `(args, session) => {scope, resourceId}` extractor. The proxy resolves the resource and calls `PermissionService.can` after the role rank check.
- Frontend: a `useEditScope(resourceId)` hook returns `{canEditPage, canEditModule, canEditElement}` so editors render the right affordances.
- The existing `editedBy` audit stamping continues unchanged — we record who actually saved, not whose permission allowed it.

## Decisions (2026-05-02)

1. **Admin override** — **YES, admins bypass** the per-resource check. Role rank `admin` skips grant evaluation. Permissions only narrow scope for editor / viewer roles.
2. **Inheritance** — **NO, levels are independent.** Page-edit on /about does NOT imply module-edit on its sections. A user can have page-edit (metadata, ordering) on /about while sections stay read-only. More precise; UX must surface this clearly.
3. **Default owner on create** — **creator gets a grant** automatically. Non-admin creates a page → `Permissions` row written for that user at page scope. Same for module instances.
4. **Translations get their own permission concept**, NOT the generic `Permissions` table. Driver: a user might be a **translator-only** — read-only across the rest of the system, full edit on translation keys. Bigger pattern: permissions are expressed as **functional roles** (`translator`, `content-editor`, `page-owner`, `module-designer`) where each role declares its own responsibility surface. A user picks up one or more functional roles in addition to (or instead of) the rank-based role. The `Permissions` table holds the role assignment; each functional role's resolver decides what the role can touch.

## Functional-role model (carried by decision #4)

Two layers of authz from now on:

- **Rank role** — `viewer` < `editor` < `admin`. Existing rank-based gating on mutations. Unchanged.
- **Functional role** — `translator`, `content-editor`, `page-owner`, `module-designer`, `inventory-manager`, etc. Each role:
  - Owns a **declarative responsibility set** — e.g. `translator: {translations: 'edit', everything-else: 'read-only'}`.
  - Lives next to the feature it concerns. The `languages` feature owns the `translator` role's resolver; `posts` owns `content-editor`; etc. Folds into the Class Loader contract — each Loader can export `functionalRoles: FunctionalRoleDescriptor[]`.
  - Composes additively. A user with `translator` + `content-editor` gets both surfaces; the lattice is the union, not the intersection.

Page / module / element grants from §"The three levels" still exist but as **resource-scoped overlays on top of the functional role**. A `content-editor` who also has `page-edit:/about` can edit /about even if their default content-editor scope wouldn't grant it.

## Decisions, batch 2 (2026-05-02)

5. **Bundle import / publishing — admin-only stays.** Both touch many resources at once; publishing already requires the existing `canPublishProduction` capability. Functional roles do NOT grant bundle/publish access — admin rank required.
6. **Permission caching — per-request cache in GraphQL context.** First check on a `(userId, scope, resourceId)` triple in a request hits Mongo; subsequent checks in the same request read the request-scoped cache. Cache lifetime ends with the request; no cross-request invalidation needed.
7. **Functional-role discovery — `assignable: true` opt-in.** Roles default to internal/system; the admin "assign roles to user" picker only lists roles whose Loader declares `functionalRoles: [{id: ..., assignable: true}]`. Keeps internal-only roles hidden.
8. **Translation flag mapping — drop the shortcut.** `siteFlags.inlineTranslationEdit` is replaced by the `translator` functional role. Editors who used to inherit translation edit through the flag now need an explicit role assignment. One-shot migration: existing installs with the flag ON → grant the `translator` role to every editor-rank user at boot.

## Q10 — three-dimension grants (2026-05-03)

The `Permissions` rows + functional roles described above stay; Q10 adds an
**orthogonal** lighter-weight surface for the common case "let editor X
mutate feature Y on page Z in locale W". Three dimensions, composable on
the user via `IUser.grants`:

```ts
type FeatureGrant = {kind: 'feature'; feature: string};   // can mutate this feature
type PageGrant    = {kind: 'page';    page: string};      // can edit this page slug
type LocaleGrant  = {kind: 'locale';  locale: string};    // can edit/translate this language
type Grant        = FeatureGrant | PageGrant | LocaleGrant;
```

### Evaluation contract (intersection semantics)

A mutation declares which dimensions it is gated on through its feature
manifest's `authz.resourceGated`. The extractor returns
`{dimensions: ['feature','page',...], values: {feature, page, locale}}`.
For each declared dimension the user must hold a matching grant — ALL
of them. If any one is missing, `ResourceForbiddenError` is thrown.

- **Admin rank bypasses.** `session.role === 'admin'` skips the dimension
  loop entirely. Same rule as the existing per-resource gate.
- **Missing dimension value is a hard deny.** If the extractor returns
  `{values: {feature: 'Posts', page: ''}}` for a method gated on `page`,
  the call is rejected — no "open by default" fallback.
- **Empty grants are a deny.** A non-admin with `grants: []` cannot pass
  any gated mutation. Bootstrap a fresh editor with at least the feature
  grants they need.

### Acceptance per dimension

- **`feature`** — Posts manifest declares `dimensions: ['feature', 'page']`
  on `savePost` / `deletePost` / `setPostPublished`. An editor with
  `{kind:'feature', feature:'Posts'}` (and the matching page grant) can
  call them; without `feature:Posts` they're blocked.
- **`page`** — same Posts wiring. The page is extracted from
  `args.post.slug` (savePost) or `args.id` (delete / setPublished). An
  editor with feature-grant but no matching `{kind:'page', page:'/blog/post-1'}`
  is denied.
- **`locale`** — applied analogously by translation-side mutations
  (Languages feature contributes its own `resourceGated` extractors that
  pull `args.locale`). Editors without the matching `{kind:'locale'}`
  grant cannot edit translation keys for that language.

### Wiring

- `services/features/Auth/authz.ts` — `guardMethods` now takes an optional
  `GrantResolver`. The Next-route resolver (`services/api/graphqlResolvers.ts`
  → `buildGrantResolver`) resolves the caller's grants once per request via
  `userService.getUser({email})` and memos the promise.
- `ui/admin/features/Users/Users.tsx` — modal exposes three `Select mode="tags"`
  fields (Feature / Page / Locale grants); the VM rebuilds the discriminated
  `Grant[]` union on save.

### Reference

- One example per dimension — see Posts manifest (`feature` + `page`) for
  the canonical wiring; Languages translation mutations are the
  `locale` reference.
- Users assigned via the admin Users pane (`/admin → Users → Edit`).
- Tests: `services/features/Auth/__tests__/grants.test.ts`.
