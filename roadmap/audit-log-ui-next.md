# Audit log — UI surfacing **Shipped**

**Chronological `AuditLog` collection live.** [`AuditService`](../src/Server/AuditService.ts) maintains append-only rows `{id, at, actor, collection, docId, op, diff?, tag?}`. Indexes: `at desc` for list, `{collection, docId, at desc}` for per-doc history, `{actor.email, at desc}` for per-editor filter, and a TTL index on `at` honouring `AUDIT_LOG_RETENTION_DAYS` (default 90). Diff payload size-capped at 10 kB — oversize writes record with `diff: null` so chronology survives bulk ops.

**Emitter centralised in [`runMutation`](../src/Server/mongoDBConnection.ts).** Every conflict-aware mutation (Section, Theme, Post, Footer, SiteFlags, SiteSeo, TranslationMeta, Logo, Language) now takes an `auditTrace` callback that records `{collection, docId, op, actor.email}` after a successful write. Delete-style mutations (`deleteTheme`, `deletePost`, `deleteLanguage`, `removeSectionItem`) record directly. `publishSnapshot` + `rollbackToSnapshot` record with `tag: 'publish' | 'rollback'` so the UI can highlight them.

**Admin UI** — [`<AuditTab>`](../src/frontend/components/Admin/AdminSettings/AuditTab.tsx) is a new admin-only tab under Site settings. [`AuditApi`](../src/frontend/api/AuditApi.ts) wraps the `getAuditLog` / `getAuditCollections` / `getAuditActors` GraphQL queries added to [`schema.graphql`](../src/Server/schema.graphql) + [`schema.generated.ts`](../src/frontend/gqty/schema.generated.ts). Filters: actor (dropdown seeded from `distinct`), collection (dropdown), op (create/update/delete), docId (free-text), date range. Row click opens a right-hand `<Drawer>` with the JSON diff pretty-printed. Paginated at 50/page.

**Server authz** — `getAuditLog`, `getAuditCollections`, `getAuditActors` all gated at `admin` in [`authz.QUERY_REQUIREMENTS`](../src/Server/authz.ts). Editors + viewers can't see the trail; diffs can carry user text.

**Scope explicitly held out of v1 (per plan)**: rollback-from-row (view-only), richer structured diff (before/after wiring per service would need separate design), per-collection field-level diff filtering.

---

*Original plan below.*

## Goal

Inline per-doc audit stamps (who/when last touched) already render on page tabs, section cards, and every settings tab. Next step: decide whether those are enough, or we need a chronological `AuditLog` collection + Site-settings → Audit tab for historical trace.

## Design

### Trigger for building it

- Editors can't answer "who broke the footer last Tuesday?" from inline stamps alone (stamps only show *last* edit)
- Or: compliance / rollback needs require the full trail

If neither is true, do not build this. Inline stamps are sufficient and cheaper.

### If building it

- New `AuditLog` collection, append-only
- Shape: `{ id, at, actor: {email, role}, collection, docId, op: 'create'|'update'|'delete', diff?: {before, after} | null }`
- Diff is optional and may be `null` for deletes or oversize changes (bundle imports). Size-cap diff at 10 kB; larger writes go in without the diff.
- Every service method that today does `auditStamp()` also pushes an `AuditLog` row. Centralise via a helper so we don't forget.
- UI: Site settings → new Audit tab. Table with filters (actor, collection, op, date range), virtualised scroll. Click a row → side panel with full diff (react-diff-view or similar).
- Retention: 90 days by default, configurable via env.

## Files to touch

- `src/Server/AuditService.ts` (new)
- `src/Server/audit.ts` — wrap `auditStamp` to also emit the log row
- Every `*Service.ts` — no change to call sites, but verify coverage
- `src/frontend/components/Admin/AdminSettings/AuditTab.tsx` (new)
- `GraphQL schema` — `getAuditLog(filter, page)`
- GQty regen or manual patch

## Acceptance

- Every mutation creates a row; reads never do
- Filter by actor email → only rows from that actor
- Diff side panel renders legibly for a realistic section update
- Bundle import creates one "bulk" entry per collection (not thousands)
- Old entries beyond retention drop on next boot (TTL index on `at`)

## Risks / notes

- Scope creep: do NOT add "revert this change" from the audit UI in v1. View-only.
- Performance: index `(collection, docId, at desc)` and `(at desc)`. Don't forget the TTL index.
- Privacy: diff can include user text. Make sure user-visible diffs respect admin role (viewers shouldn't see audit at all).

## Effort

**M · 4–6 h** (if we decide to build it)

- Service + helper wiring: 1.5 h
- GraphQL + frontend wire-up: 1.5 h
- Audit tab UI + filters: 2 h
- Diff panel: 1 h
- Retention + TTL index + tests: 1 h
