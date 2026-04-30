# Multi-level edit granularity

Status: Planned
Last updated: 2026-04-29

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

## Open questions

1. **Admin override** — admins always pass, regardless of grants. Confirm.
2. **Inheritance** — does page-edit on /about imply module-edit on its sections? Probably yes (page is the broader scope), but it complicates revocation.
3. **Default for new pages/modules** — created by a non-admin, who owns the new resource? Probably the creator gets a grant automatically.
4. **Bundle import / publishing** — these touch many resources at once. Probably stays admin-only (publishing already requires `canPublishProduction`).
5. **Translation keys as resources** — any-edit on translations is already gated by `siteFlags.inlineTranslationEdit`. Bring that under the same Permissions table or keep it separate?
6. **Performance** — checking grants on every method call on every request adds Mongo round-trips. Cache per-request in the GraphQL context.
