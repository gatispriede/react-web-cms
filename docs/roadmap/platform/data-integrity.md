# F2 — data integrity: action locking + cascade cleanup

## Goal

Two related concerns surfaced together because they share the same root cause — admin actions today assume a fast network and an isolated data model:

1. **Action locking** — on a slow server / slow connection a user clicks `Delete page` and waits. They click again. The mutation runs twice. Outcomes today range from harmless (second call no-ops because the row is already gone) to destructive (a save races a delete and resurrects orphan data).
2. **Cascade cleanup** — when a page is deleted, every dependent record should go with it: its sections, those sections' module content, page-scoped resources (SEO settings, cache versions, ISR revalidate entries, Permissions grants keyed on `page:<slug>`), and — once F1 ships — its sub-pages. Today the deletion path drops the `Navigation` row only; orphans accumulate silently.

Out of scope for v1: cross-site bundles, undo/restore. Both are clean follow-ups once the cleanup contract is in place.

## Why now

- Customer-facing destructive actions (delete page, delete language, bulk import) are the most common source of surprise data loss. Idempotency + locking are the defensive pair.
- F1 (sub-pages) lands on top of this — a sub-page delete that doesn't cascade to children would be a regression on day one.
- C9 (production caching) added per-feature cache version stamps. The cache layer already needs a "page deleted" signal; cascade cleanup is the natural place to issue it.

## Design

### Part A — action locking (frontend + backend)

Two layers, in priority order:

**1. Backend — server-side mutation idempotency keys.**
- Every destructive mutation (`deletePost`, `deleteNavigationItem`, `removeSectionItem`, `deleteLanguage`, `deleteTheme`, `removeUser`, `revokePermission`, future `deletePage`) accepts an optional `idempotencyKey: String` argument.
- A request-scoped `IdempotencyService` (Redis-backed; falls back to Mongo `Idempotency` collection if Redis is unavailable) stores `key → {firstSeenAt, response}` with a 5-minute TTL.
- `runMutation` wrapper checks the key on entry: cache hit → return the cached response unchanged. Cache miss → execute, store, return.
- The key is generated client-side per user click (`crypto.randomUUID()` at the start of the mutation handler, not at component render — avoids stale keys across re-renders). Replays of the *same* click (network retries, double-click) collapse to a single execution.

**2. Frontend — disabled-while-pending UI primitive.**
- `useGuardedAction(fn)` hook returns `{trigger, pending}` where `trigger` ignores re-entrant calls until the underlying promise settles.
- Replace ad-hoc `loading` state across the destructive-action surface (mostly `Popconfirm` callbacks today).
- Lint rule: any `onConfirm`/`onClick` calling a known destructive mutation must go through `useGuardedAction`.

The two layers are belt-and-braces. Backend idempotency is the source of truth (handles all paths: API client, MCP tool, retry middleware). The frontend lock is UX polish.

### Part B — cascade cleanup (backend)

**Reference graph** — every cleanup is declarative, owned by the feature that owns the *child* data:

```typescript
// services/infra/featureManifest.ts — extend FeatureManifest
interface CascadeRule {
    /** When a record in `parentFeature.collection` is deleted by id... */
    parentFeature: string;
    parentCollection: string;
    /** ...delete every doc in this feature's collection where... */
    childCollection: string;
    /** ...this query matches the parent id. */
    matchByParentId: (parentId: string) => Filter<any>;
}

interface FeatureManifest {
    // ...
    cascadeRules?: readonly CascadeRule[];
}
```

**Worked example — page deletion:**

| Owner feature | Cascade rule |
|---|---|
| Navigation | (parent) `Navigation` row by `id` triggers cascade |
| Navigation | `Sections` where `sectionId in deletedNav.sections` |
| Seo | `SiteSeo.pages.<slug>` cleared |
| Posts | `Posts` where `pageSlug === deletedNav.page` (if posts pin to a page) |
| Permissions | `Permissions` where `scope='page' && resourceId===deletedNav.page` |
| Sub-pages (F1) | `Navigation` where `parent === deletedNav.id` (recursive — invokes the same cascade for each child) |
| Cache | `cacheVersionKeys: ['navigation', 'pages', 'seo', 'permissions']` bumped |

**Engine** — `cascadeDelete(feature, collection, id, ctx)` walks the registered `cascadeRules`. Each rule moves its matched docs into a parallel `Trash` collection (e.g. `Sections.trash`) with a `deletedAt` timestamp + a `trashGroup` ULID that ties every record from one cascade together. A Mongo TTL index on `Trash.deletedAt` (24h) auto-purges. Restore reads `Trash` by `trashGroup`, writes records back to their origin collections, deletes the trash rows, and bumps the relevant `cacheVersionKeys`. Runs inside a transaction on multi-node Mongo; falls back to best-effort sequence with audit-logged failures on single-node dev.

Cascade rules live in the feature that *owns* the dependent data, not in `Navigation` — keeps the dependency direction clean (Seo knows about pages; Navigation doesn't need to know about Seo). A new feature that adds page-scoped data only needs to declare its own cascade rule; no edits to `Navigation`.

**Audit** — every cascade emits one audit row per affected collection: `{op: 'cascade-delete', parent: 'page:<slug>', counts: {Sections: 4, Posts: 0, Permissions: 2}}`. Visible in the existing audit log.

### Part C — sub-page cascade (depends on F1)

Sub-pages reuse the same `cascadeRules` machinery. A page delete with children:

1. Recursively call `cascadeDelete` on each child first (depth-first — children of children clear first).
2. Then run the parent's cascades.
3. All inside a single transaction so a mid-delete failure leaves the tree unchanged.

If F2 lands before F1, the engine is already in place and the sub-page rule is a one-line addition.

## Files to touch

- `services/infra/featureManifest.ts` — extend manifest schema with `cascadeRules`.
- `services/infra/cascadeDelete.ts` (new) — engine.
- `services/infra/idempotency.ts` (new) — Redis/Mongo-backed key store.
- `services/features/Auth/runMutation.ts` (or wherever `runMutation` lives) — idempotency check on entry.
- Per-feature loader edits — declare `cascadeRules` for Navigation, Seo, Posts, Permissions, Sub-pages.
- `ui/admin/lib/useGuardedAction.ts` (new) — frontend hook.
- ESLint custom rule (or grep-based pre-commit) — destructive mutation calls must go through the hook.

## Acceptance

- `deletePage` triggered twice in 5s by the same user runs the cascade once; the second call returns the cached response.
- After deleting a page, no orphan `Sections` remain (`db.Sections.find({sectionId: {$nin: <every nav.sections array>}}).count() === 0` — runnable as an integrity test in CI).
- Audit log shows one cascade entry per delete with non-zero child counts.
- Frontend: `Delete page` button stays disabled until the mutation settles; mashing it once cannot fire a second request.
- Tests:
  - Idempotency unit test: 50 concurrent calls with the same key → 1 execution, 50 identical responses.
  - Cascade integration test: seed page + 3 sections + 2 permissions, delete page, assert all 6 records gone.
  - Sub-page recursion test (paired with F1): 3-level tree, delete root, assert all 3 levels cleared.

## Risks / notes

- Single-node Mongo (dev / cheap deployments) doesn't support multi-doc transactions. The engine must detect and fall back to sequential best-effort with explicit audit rows on partial failure. The existing `mongo-bootstrap.sh` already provisions a replica set in production; document the dev-vs-prod difference in the runbook.
- Idempotency key TTL (5 min) is a deliberate trade-off: long enough to absorb retries + double-clicks, short enough that a user repeating an action a minute later (e.g. "I changed my mind, delete it again") gets fresh execution. If user feedback says the window is wrong, tune via `vars.IDEMPOTENCY_TTL_SECONDS`.
- Cascade rules are declarative on purpose. Imperative cascade code in each delete handler is exactly what creates orphan data — every new feature has to remember to update every other feature's delete handler. Declarative inverts the dependency.

## Effort

**XL · 4–6 engineering days**

- Idempotency engine + Redis/Mongo store: 1 day
- `useGuardedAction` hook + lint rule + sweep destructive callsites: 0.5–1 day
- Cascade engine + manifest schema: 1 day
- Per-feature `cascadeRules` declarations + tests: 1–1.5 days
- Sub-page recursion (paired with F1 if it lands first): 0.5 day
- Audit + observability + runbook: 0.5 day

## Decisions (resolved 2026-05-03)

1. **Idempotency key scope** — global. Single Redis namespace `idempotency:<key>`; UUIDv4 collisions across the 5-min TTL are astronomically unlikely. Simpler than scoped lookups; the collision space is large enough that scoping would be theatre.
2. **Soft-delete with 24h TTL.** Cascade moves records to a `Trash` collection with a Mongo TTL index of 24h. Same-day "oh shit" recovery is free; storage cost stays bounded. Restore writes the records back to their original collections and bumps `cacheVersionKeys`. After 24h the TTL purges trash entries permanently — past that, the deletion is irreversible. Read queries across the app keep their existing semantics (they query the original collections, which are missing the deleted rows); no `deletedAt: null` filter creeps into hot paths.
3. **Disk-image cleanup** — cascade is DB-only. Image files in `public/images/` are never moved or deleted by a page delete. Files stay where they are; the page's image-name references travel into `Trash` along with the rest of the records. Restore re-attaches references to the on-disk files (which never left). After the 24h TTL purges the trash, any now-truly-orphaned files are cleaned by `rescan-images` on demand. This avoids the race / shared-image problem entirely.
