---
name: admin-content-releases
description: First-class Release object — group N draft documents → preview the site at the release's perspective → publish atomically → roll back. The 2025 Sanity differentiator vs Strapi / Payload / Contentful.
research: see research-findings-2026-05-12.md §1 Content Releases
---

# Content Releases — atomic publish groups

## Goal

Ship a **Release** entity that:

- Groups N draft documents (pages, posts, products, navigation, footer, theme changes)
- Previews the public site **as it would look at this release's perspective** — before publishing
- Publishes all members atomically (or none, if any validation fails)
- Schedules for a future date/time
- Rolls back to pre-release state if needed

Reference: Sanity Content Releases (shipped Spring 2025) — the 2025 differentiator vs Strapi, Payload, Contentful.

## Why now

- Per-document publish creates content drift: footer points to a page that hasn't been published yet; theme change goes live before the new layout works against it. Operators currently work around it by publishing in careful sequence and praying.
- Release groups remove that risk — preview "what will go live together," confirm, ship.
- Differentiator: of the open-source / mid-market CMSes, only Sanity ships this. Shipping it here closes the gap on the most-asked-for editorial feature.

## Design

### Schema

```ts
// shared/types/IRelease.ts
export type ReleaseStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'rolled-back';

export interface IRelease {
    id: string;
    title: string;
    description?: string;
    members: ReleaseMember[];
    status: ReleaseStatus;
    scheduledFor?: string;          // ISO timestamp; null = manual publish
    publishedAt?: string;
    publishedBy?: string;
    rollbackOf?: string;            // points at the release this one rolled back
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    version?: number;               // OCC
}

export interface ReleaseMember {
    entity: 'page' | 'post' | 'product' | 'theme' | 'navigation' | 'footer' | 'seo' | 'language';
    id: string;
    /** Pointer to the draft revision snapshot. The release pins the exact bytes, so editing the
     *  doc after adding to a release doesn't change what publishes. */
    draftRevisionId: string;
    /** Pointer to the doc state at the moment of adding — used for rollback. */
    preReleaseSnapshotId?: string;
}
```

Two new Mongo collections: `Releases` (the entity) + `ReleaseSnapshots` (frozen revisions per member).

### Service shape

`services/features/Releases/ReleasesService.ts`:

- `createRelease(input)` — empty release
- `addMember(releaseId, entity, id)` — snapshots current draft + frozen pre-release state
- `removeMember(releaseId, memberKey)`
- `previewRelease(releaseId)` — returns "site state if this release were published right now" (composed from current published state + release members' draft revisions, layered)
- `publishRelease(releaseId)` — validates all members pass their feature-specific guards, then writes atomically (Mongo transaction or compensating-write fallback)
- `scheduleRelease(releaseId, when)` — sets `scheduledFor`; background scheduler picks up
- `rollbackRelease(releaseId)` — creates a new "rollback" release whose members restore pre-release snapshots

Atomic publish uses Mongo's multi-document transactions; if not available, falls back to sequential writes wrapped in a saga with compensating actions.

### Preview "perspective"

When previewing a release, the public site renderer reads from a composite source:

- For entities **in the release**: use the release's frozen draft revision
- For entities **not in the release**: use the currently published state

The composite reads via a `previewClient.fetch(query, {perspective: releaseId})` API that the existing data layer is extended to accept. SSR pages accept `?previewRelease=<id>` query param when running inside the admin preview iframe.

Sanity uses the term "perspective" — we'll keep it for vocabulary parity.

### Admin pane

`/admin/release/releases` — new pane in the existing Release area (alongside Bundle, Trash).

- List view: every release with status badge, member count, scheduled-for if any, last-modified
- Detail view:
  - Members list — table of (entity / id / title / draft-version) with remove buttons
  - **Preview release** button — opens the public site in the preview iframe with `?previewRelease=<id>`
  - **Publish now** button — opens confirm modal listing every member + what will change, requires explicit confirmation (typing the release title)
  - **Schedule** — date+time picker
  - **Rollback** button (only on `published` status) — creates a rollback release
- Audit trail per release: who created, who added each member, who published

### Per-feature "Add to release" affordance

Every editor pane gets a button:

```tsx
<Button onClick={() => releasesVm.addCurrentToRelease()}>Add to release…</Button>
```

Opens a small modal: "Add Page 'About' to release" with a Select picking an existing release or "+ Create new release." Powered by a shared `useAddToRelease(entity, id)` hook so feature panes don't reimplement the flow.

### Rollback semantics

`rollbackRelease(releaseId)`:

1. Creates a new release titled "Rollback of <originalTitle>" with `rollbackOf` pointing at the original
2. Members = the original's `preReleaseSnapshotId` snapshots
3. Auto-publishes (since rollbacks are typically urgent — no "preview rollback first" flow in v1)
4. Original release's status changes to `rolled-back`

If the original release contained creates (no pre-release snapshot), rollback restores from the corresponding `*.trash` collection — chained through the existing cascade engine.

## Files to touch

- `shared/types/IRelease.ts` (new)
- `services/features/Releases/ReleasesService.ts` (new)
- `services/features/Releases/ReleasesServiceLoader.ts` (new)
- `services/features/Releases/feature.manifest.ts` (new)
- `services/features/Releases/atomicPublish.ts` (new) — transaction wrapper + saga fallback
- `services/features/Releases/perspectiveResolver.ts` (new) — composes published + release-draft
- `ui/admin/features/Releases/Releases.tsx` (new)
- `ui/admin/features/Releases/ReleaseDetail.tsx` (new)
- `ui/admin/features/Releases/ReleasesViewModel.ts` (new)
- `ui/admin/features/Releases/ReleasesAdminUILoader.ts` (new)
- `ui/admin/shell/AddToRelease/useAddToRelease.ts` (new) — shared hook
- Every editor pane (`Pages`, `Posts`, `Products`, `Themes`, `Navigation`, `Footer`, `Seo`, `Languages`) — add "Add to release" affordance via the shared hook
- `services/features/Mcp/tools/releases.ts` (new) — MCP coverage: `release.create`, `release.addMember`, `release.publish`, `release.schedule`, `release.rollback`
- Tests: service-level (atomic publish + rollback round-trip + concurrent publish guard); e2e (create release → add 3 members → preview → publish → assert all live → rollback)

## Starter code

ServiceLoader follows **Pattern A** in [agent-handoff-format.md](../_meta/agent-handoff-format.md).

Atomic publish skeleton:

```ts
async publishRelease(input: {releaseId: string; idempotencyKey: string}): Promise<string> {
    const release = await this.releasesDB.findOne({id: input.releaseId});
    if (!release) throw new Error('release not found');
    if (release.status !== 'draft' && release.status !== 'scheduled') {
        throw new Error(`cannot publish from status ${release.status}`);
    }

    // 1. Validate every member against its feature's publish guard
    for (const m of release.members) {
        const guard = this.guards.for(m.entity);
        const ok = await guard.canPublish(m.id, m.draftRevisionId);
        if (!ok) throw new Error(`member ${m.entity}:${m.id} failed validation`);
    }

    // 2. Atomic write — Mongo session if available, sequential saga if not
    const session = this.client.startSession();
    try {
        await session.withTransaction(async () => {
            for (const m of release.members) {
                await this.publishers.for(m.entity).publish(m.id, m.draftRevisionId, session);
            }
            await this.releasesDB.updateOne(
                {id: release.id},
                {$set: {status: 'published', publishedAt: nowIso(), publishedBy: ctx.userId}},
                {session},
            );
        });
    } finally {
        await session.endSession();
    }

    return JSON.stringify({ok: true, releaseId: release.id});
}
```

## Acceptance

1. Empty release can be created via UI + via MCP
2. Adding a member snapshots the current draft + the pre-release state of the published version
3. Preview shows a composite (release members' drafts + everything else's published state)
4. Publish writes atomically — if any member fails validation, nothing publishes
5. Schedule fires on time + executes the same path as manual publish
6. Rollback creates a new release that restores pre-release snapshots
7. Concurrent publish attempts on the same release are rejected (OCC + status guard)
8. MCP coverage parity: `release.*` tools cover create / addMember / publish / schedule / rollback
9. E2E: create release with page + post + theme change → preview shows composite → publish → all live → rollback → all reverted

## Effort

**XL · ~2-3 days AI** (real architectural item; transaction + saga edge cases + per-feature guard wiring).

- Schema + service + atomic publish + saga fallback: ~1 day
- Perspective resolver + preview client extension: ~half day
- Admin pane + per-feature "Add to release" hook: ~half day
- MCP coverage: ~half day
- Tests: ~half day

## Dependencies

- Mongo session / transaction support — verify against current deployment (DigitalOcean Mongo confirmed; embedded mongodb-memory-server supports transactions only via replica-set mode)
- Existing cascade engine for create-rollback path
- Existing audit hooks via `runMutation`

## Open questions

- **[OPERATOR DECISION]** Should the operator be able to assign release ownership to another user, or always-creator-only? Recommend: creator owns + can delegate.
- **[OPERATOR DECISION]** Scheduled publish — fail-loud (admin banner + notification) vs silent retry? Recommend: fail-loud after 3 retries with audit entry.

## Out of scope

- Approval workflows / multi-step sign-off on releases (separate item if operator requests)
- Cross-site releases (when multi-site lands; v1 is single-site)
- Real-time collaborative editing inside a release (presence work, separate item)
