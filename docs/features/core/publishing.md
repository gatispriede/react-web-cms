# Publishing

## Overview

The CMS has three orthogonal publishing mechanisms: **snapshots** (whole-site freeze + rollback), **bundles** (export/import JSON), and **post drafts** (per-blog-post toggle).

## Snapshots

A published snapshot is a frozen copy of: Navigation + Sections + Languages + Logos + Images + non-draft Posts.

- **Publish:** Admin → Publish → Publish now. `PublishService` writes a `PublishedSnapshots` doc and stamps the audit log with `tag: 'publish'`.
- **Rollback:** Admin → Publish → select a past snapshot → Roll back. Restores all collections from the frozen copy; stamps the audit log with `tag: 'rollback'`.
- Rollback resets per-doc `version` counters, so any in-flight admin edits will conflict on their next save — the `ConflictDialog` handles this gracefully.
- The active snapshot is what the public site serves; unpublished edits are only visible in the admin preview.

## Bundles (export / import)

Bundles cover the same scope as snapshots and are serialised to a single downloadable JSON file.

- **Export:** `GET /api/export` — returns a bundle JSON with all content.
- **Import:** `POST /api/import` — overwrites all content from the uploaded bundle. Destructive; import is gated at `admin` role.
- Use case: backup before a risky migration, seeding a new environment, or transferring content between instances.

## Post drafts

Blog posts have a `draft: boolean` field. Draft posts are excluded from snapshots and not publicly visible. Toggle in admin → Blog → edit post → Draft switch.

## Audit trail

Every publish and rollback event is recorded in the `AuditLog` collection with `tag: 'publish'` or `tag: 'rollback'`. See [`admin-experience.md`](admin-experience.md) for the audit log UI.

## Architecture reference

Full technical detail: [`../architecture/publishing.md`](../architecture/publishing.md).
