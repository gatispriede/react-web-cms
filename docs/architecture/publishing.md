# Publishing & content lifecycle

The CMS supports three orthogonal lifecycle mechanisms. Pick the right one for the job — they don't substitute for each other.

| Mechanism | Scope | Reversible? | Used for |
|---|---|---|---|
| **Snapshots** ([`PublishService`](../../src/Server/PublishService.ts)) | Whole site (Nav + Sections + Languages + Logos + Images + non-draft Posts) | Yes (rollback appends a new snapshot) | Production-ready cuts, "publish" button |
| **Bundles** ([`BundleService`](../../src/Server/BundleService.ts)) | Same as snapshots, packaged as a downloadable JSON file | Manual (re-import the previous bundle) | Backup, environment migration (staging → prod), disaster recovery |
| **Drafts** (`Post.draft = true`) | Single blog post | Yes (toggle the flag) | Author-in-progress posts that shouldn't show up on `/blog` |

## Snapshots (`PublishedSnapshots` collection)

`PublishService.publishSnapshot(publishedBy, note)` copies the current state of the editable collections into one immutable doc with metadata: who clicked publish, optional note, current timestamp. The public site is **not** automatically served from snapshots — the read path still hits the live collections by default. Snapshots are recovery / history.

`rollbackTo(snapshotId, rolledBackBy)` doesn't restore in-place; it copies an old snapshot's payload into a new snapshot with `rolledBackFrom: <snapshotId>` set, then writes that payload back over the live collections. The rollback itself becomes a snapshot, so the chain is auditable.

`getHistory(limit)` returns recent snapshots for the Publishing tab — admin sees publisher email, timestamp, note, and a "Rollback to this" action.

Capability gate: only users with `canPublishProduction = true` see the Publish button (see [`auth-roles.md`](auth-roles.md)).

## Bundles — export & import

[`BundleService`](../../src/Server/BundleService.ts) packages the editable collections into a single JSON blob delivered as a download via [`/api/export`](../../src/frontend/pages/api/export.ts). The shape mirrors a snapshot but is intended for cross-environment movement: download from staging, import into prod, ship a new install with seed content.

`/api/import` reads an uploaded JSON, validates the shape, **runs `deleteMany({})` on the destination collections**, and inserts the bundle. Same-origin guard prevents cross-site replacement attacks.

Recovery path when an import wiped local images: [`AssetService.rescanDiskImages`](../../src/Server/AssetService.ts) walks `src/frontend/public/images/` and inserts a DB row for any file missing one. Surfaced via [`/api/rescan-images`](../../src/frontend/pages/api/rescan-images.ts) for the admin "Rescan disk" button.

## Drafts (blog only)

`Post.draft: boolean`. List queries default to `{draft: {$ne: true}}`; pass `includeDrafts: true` to bypass (admin uses this; public `/blog` route doesn't). `setPostPublished(id, publish)` flips the flag; if publishing a previously-unpublished post, also stamps `publishedAt`.

## Optimistic-concurrency `version` and conflicts

Every editable collection now carries a `version: Int` field bumped on each save. Concurrent admins editing the same Section / Theme / Post / SiteSettings row see a `ConflictError` instead of silent overwrite — the section editor surfaces a `<ConflictDialog>` with Take-theirs / Keep-mine.

This **does not interact with snapshots** — snapshot publish/rollback writes through `replaceMany` directly and ignores per-doc `version`. A rollback to an older snapshot resets `version` on every restored doc back to whatever was stored at snapshot time. If two admins edit the same section, then one publishes, and the other's edit lands on the now-published live row, that second edit will *succeed* (versions still match for them) but be lost on the next publish. This is acceptable: publish is intentional state-replacement; conflict mitigation is for unintentional concurrent edits.

Full design + rollout plan: `roadmap/multi-admin-conflict-mitigation.md`.

## Audit triplet & history

Every save / publish / rollback stamps the actor:

| Action | Field set |
|---|---|
| Content edit | `editedBy`, `editedAt`, `version` |
| Publish snapshot | `publishedBy`, `publishedAt`, optional `note` |
| Rollback | New snapshot with `rolledBackFrom: <oldId>` + `publishedBy`, `publishedAt` |
| Bundle import | No actor stamp on the docs themselves — bundle replaces in bulk |

The `AuditBadge` component renders the latest `editedBy` / `editedAt` next to every page tab and on every settings card. Bundle imports clear the badges (the bundle's docs may not carry audit fields); rescan-disk leaves them.

Last reviewed: 2026-04-19.
