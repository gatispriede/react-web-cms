# Admin experience

## Overview

The admin is a single-page React surface at `/admin`. It combines content editing, settings, conflict detection, and an audit trail into one interface.

## Roles and access

Three roles control what an admin user can do:

| Role | Capabilities |
|---|---|
| `viewer` | Read-only — can browse admin but cannot save |
| `editor` | All content edits; cannot publish or manage users |
| `admin` | Everything: publish, rollback, user management, import |

A separate `canPublishProduction` flag on the user doc gates the Publish button independently of role — useful for editor-level users who are trusted to publish.

See [`../architecture/auth-roles.md`](../architecture/auth-roles.md) for the full auth model.

## Multi-admin conflict detection

### Layer 1 — Optimistic concurrency

Every editable doc carries a `version` integer. The frontend stashes the version at read-time and sends it as `expectedVersion` on save. If another admin saved the doc in the meantime, the server returns a `409 ConflictError`.

The `ConflictDialog` modal offers two options:
- **Take theirs** — discard local changes, reload the server version.
- **Keep mine** — force-apply local changes, overwriting the remote state.

Collections with optimistic concurrency: Navigation, Sections, Themes, Posts, Footer, SiteFlags, SiteSeo, TranslationMeta.

### Layer 2 — Presence avatars

- Editors send a heartbeat every 15 s to `/api/presence` with `{docId, userId}`.
- The server upserts a `Presence` doc with a 45 s TTL on `updatedAt`.
- The UI polls every 15 s and renders stacked avatars (via `<PresenceHost>`) showing who else is editing the same doc.
- This is a visibility hint only — it does not block editing.

## Audit log

Every admin mutation is recorded in the `AuditLog` collection: `{id, at, actor, collection, docId, op, diff?, tag?}`.

- **Admin UI:** admin → Settings → Audit tab.
- **Filters:** actor email, collection, operation type, date range.
- **Row click** opens a Drawer with the full JSON diff.
- **Diff payload** is capped at 10 kB per event; oversized diffs record `diff: null`.
- **Publish / rollback events** carry `tag: 'publish'` or `tag: 'rollback'`.
- Paginated at 50 rows/page; gated at `admin` role.
- TTL index automatically purges old records (duration configurable on the index).

## Admin language selector

Each admin user can independently set their preferred admin UI language without affecting the published site. See [`internationalization.md`](internationalization.md) for details.

## Inline translation editing

Alt+click any translated string in the admin preview to edit it in-place. See [`internationalization.md`](internationalization.md).

## Section-item interaction (hover-reveal edit / delete)

Module-editor controls don't render statically — they're hover-revealed to keep the admin preview readable. Two layers:

- **Per-item controls** appear in the **top-left corner** of each rendered module when the cursor enters the item's bounding box: a red trash icon (delete this item) and an orange pencil icon (open the item's editor drawer).
- **Per-section controls** appear in the **top-right corner** of each section row when the cursor enters the section: a section-level delete + an `Overlay` segmented control (anchor / direction picker, see [`module-interfaces.md`](../../architecture/module-interfaces.md) — used by overlay-style sections).

The controls are inert (`opacity: 0`, `pointer-events: none`) until the parent receives `:hover`, then transition to fully interactive. They carry testids per the [test-ids convention](../../architecture/test-ids.md):

- `section-module-edit-<type>-btn` — the orange pencil on each module item
- `section-module-row-<type>` — the rendered module wrapper (hover target for the per-item controls)

**E2E implication:** Playwright specs that drive the admin must `.hover()` the row before targeting `.click()` on the edit button — otherwise the button is `display: none`-equivalent and Playwright's actionability check fails with "element is not visible". The smoke + chain specs do this in their step that opens a module editor.
