# Audit log — UI surfacing next

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
