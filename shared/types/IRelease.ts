/**
 * Content Releases — first-class entity that groups N drafts into an
 * atomic publish unit. See `docs/roadmap/admin/admin-content-releases.md`.
 *
 * A release is created in `draft` status, members are attached (each
 * member freezes a pointer + a pre-release snapshot of the live
 * collection row), then the release is published. Publish flips every
 * attached member's draft → live in a single Mongo transaction (or a
 * compensating saga on standalone Mongo). Rollback creates a new release
 * that restores the captured pre-release snapshots.
 *
 * Status state machine:
 *
 *     draft ─────────────► publishing ─────────► published
 *       │                       │                    │
 *       │                       ▼                    ▼
 *       └──────────────────► failed              rolled-back
 *
 * `draft` and `failed` are the only states from which `publish` is
 * accepted. `published` is the only state from which `rollback` is
 * accepted. Concurrent writes are guarded by `version` (OCC) +
 * `status` checks.
 */

/** Status enum — predefined, NOT free text. */
export type ReleaseStatus =
    | 'draft'
    | 'publishing'
    | 'published'
    | 'failed'
    | 'rolled-back';

export const RELEASE_STATUSES: readonly ReleaseStatus[] = [
    'draft',
    'publishing',
    'published',
    'failed',
    'rolled-back',
] as const;

/**
 * Entity kinds a release member can target. Predefined enum — agents
 * and the admin UI both validate against this list. Adding a kind
 * requires wiring a publisher in `ReleaseService.PUBLISHERS`.
 */
export type ReleaseEntityKind =
    | 'page'
    | 'post'
    | 'product'
    | 'theme'
    | 'navigation'
    | 'footer'
    | 'seo';

export const RELEASE_ENTITY_KINDS: readonly ReleaseEntityKind[] = [
    'page',
    'post',
    'product',
    'theme',
    'navigation',
    'footer',
    'seo',
] as const;

/**
 * One frozen membership row inside a release. `snapshot` captures the
 * current shape of the entity at attach time so publish writes the
 * exact bytes the operator approved. `preReleaseSnapshot` captures the
 * live row's state at attach time so rollback can restore it. Both are
 * stored inline — the spec calls for a separate `ReleaseSnapshots`
 * collection but a single collection keeps the happy-path query
 * surface simple (a release is one document).
 */
export interface ReleaseMember {
    entity: ReleaseEntityKind;
    /** Entity id — same shape as `IPost.id`, `IPage.id`, etc. */
    id: string;
    /** Human-readable label for list views — `title`/`name`/`slug`. */
    label?: string;
    /** Frozen draft bytes — what `publish` will write to the live collection. */
    snapshot: Record<string, unknown>;
    /**
     * Snapshot of the live row at attach time. Used by `rollback` to
     * restore. `null` means the entity did not previously exist (a
     * "create" within the release) — rollback for those members deletes.
     */
    preReleaseSnapshot: Record<string, unknown> | null;
    attachedAt: string;
    attachedBy?: string;
}

export interface IRelease {
    id: string;
    title: string;
    description?: string;
    status: ReleaseStatus;
    members: ReleaseMember[];
    /** Manual publish if absent. ISO timestamp. */
    scheduledFor?: string;
    publishedAt?: string;
    publishedBy?: string;
    /** Last publish-time error message — surfaced when `status === 'failed'`. */
    lastError?: string;
    /** Points at the release this one rolled back, if any. */
    rollbackOf?: string;
    createdAt: string;
    createdBy?: string;
    updatedAt: string;
    /** Optimistic-concurrency counter. */
    version: number;
}

/** Summary projection used by list views — no member bodies. */
export interface IReleaseSummary {
    id: string;
    title: string;
    status: ReleaseStatus;
    memberCount: number;
    scheduledFor?: string;
    publishedAt?: string;
    createdAt: string;
    updatedAt: string;
    version: number;
}

export function toReleaseSummary(r: IRelease): IReleaseSummary {
    return {
        id: r.id,
        title: r.title,
        status: r.status,
        memberCount: r.members.length,
        scheduledFor: r.scheduledFor,
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        version: r.version,
    };
}
