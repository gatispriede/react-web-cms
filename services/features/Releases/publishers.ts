/**
 * Per-entity publish + snapshot adapters for `ReleaseService`.
 *
 * A release member targets one of `RELEASE_ENTITY_KINDS`. Each kind
 * needs to answer two questions:
 *
 *   1. **snapshot(id)** — return the current live row so the release
 *      can freeze it for rollback. `null` means "doesn't exist yet"
 *      (a "create" within the release).
 *   2. **publish(snapshot, session?)** — write the frozen bytes to the
 *      live collection.
 *
 * The publishers live behind one tiny interface so `ReleaseService`
 * itself never branches on entity kind. Adding a new kind = adding one
 * entry to `buildPublishers` + a value in the `ReleaseEntityKind` enum.
 *
 * NOTE: this MVP uses direct collection writes rather than reaching
 * into each feature's domain service. The trade-off — domain services
 * own validation, soft-delete semantics, cache-version bumps. For the
 * happy path (`snapshot/publish` of a draft row) the raw write is
 * correct; richer guards (publish-time validation, cascade rebuild)
 * are intentionally cut from v1 — see `.wave0-progress.md` notes.
 */

import type {ClientSession, Db} from 'mongodb';
import type {ReleaseEntityKind} from '@interfaces/IRelease';

export interface EntityPublisher {
    /**
     * Read the live row for this entity by id. Used at attach time to
     * capture the pre-release snapshot. Returns `null` when the entity
     * doesn't exist yet.
     */
    snapshot(id: string): Promise<Record<string, unknown> | null>;
    /**
     * Write the frozen bytes to the live collection. `snapshot` is what
     * `publish` writes — typically the draft revision the operator
     * approved when attaching. `null` means "delete the live row"
     * (rollback for a release-create member).
     */
    publish(
        id: string,
        snapshot: Record<string, unknown> | null,
        session?: ClientSession,
    ): Promise<void>;
    /**
     * Human-readable label for list views. Best-effort — falls back
     * to the entity id when no friendly field exists.
     */
    label(snapshot: Record<string, unknown> | null): string | undefined;
}

/**
 * Build a publisher for a collection-backed entity. Most members are
 * one `{id}` row in one collection; this factory covers that case.
 */
function makeSimplePublisher(
    db: Db,
    collection: string,
    labelKey: 'title' | 'name' | 'slug' = 'title',
): EntityPublisher {
    const col = () => db.collection(collection);
    return {
        async snapshot(id) {
            const doc = await col().findOne({id});
            if (!doc) return null;
            // Strip mongo _id to keep snapshots round-trippable.
            const clone = {...(doc as Record<string, unknown>)};
            delete clone._id;
            return clone;
        },
        async publish(id, snapshot, session) {
            const opts = session ? {session} : undefined;
            if (snapshot === null) {
                await col().deleteOne({id}, opts);
                return;
            }
            const clone = {...snapshot, id};
            delete clone._id;
            await col().replaceOne({id}, clone as any, {upsert: true, ...(opts ?? {})});
        },
        label(snapshot) {
            if (!snapshot) return undefined;
            const v = snapshot[labelKey];
            if (typeof v === 'string' && v.trim()) return v;
            const alt = snapshot.title ?? snapshot.name ?? snapshot.slug ?? snapshot.id;
            return typeof alt === 'string' ? alt : undefined;
        },
    };
}

/**
 * Singleton-style publisher for the SiteSettings rows (footer / seo).
 * These don't have an entity `id` — they're a single `{key, value}` row.
 * The release member's `id` is the SiteSettings key (`footer` / `siteSeo`).
 */
function makeSettingPublisher(db: Db): EntityPublisher {
    const col = () => db.collection('SiteSettings');
    return {
        async snapshot(id) {
            const doc = await col().findOne({key: id});
            if (!doc) return null;
            return {key: id, value: (doc as any).value};
        },
        async publish(id, snapshot, session) {
            const opts = session ? {session} : undefined;
            if (snapshot === null) {
                await col().deleteOne({key: id}, opts);
                return;
            }
            const value = (snapshot as any).value ?? snapshot;
            await col().updateOne(
                {key: id},
                {$set: {key: id, value}},
                {upsert: true, ...(opts ?? {})},
            );
        },
        label(snapshot) {
            return snapshot ? `setting:${(snapshot as any).key ?? '?'}` : undefined;
        },
    };
}

export function buildPublishers(db: Db): Record<ReleaseEntityKind, EntityPublisher> {
    return {
        page: makeSimplePublisher(db, 'Navigation', 'name'),
        post: makeSimplePublisher(db, 'Posts', 'title'),
        product: makeSimplePublisher(db, 'Products', 'title'),
        theme: makeSimplePublisher(db, 'Themes', 'name'),
        navigation: makeSimplePublisher(db, 'Navigation', 'name'),
        footer: makeSettingPublisher(db),
        seo: makeSettingPublisher(db),
    };
}
