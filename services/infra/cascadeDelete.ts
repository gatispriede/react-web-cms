/**
 * Cascade-delete engine — F2 / `docs/roadmap/data-integrity.md`.
 *
 * `cascadeDelete(featureId, collection, parentId, ctx)` walks every
 * registered feature manifest's `cascadeRules`. For each rule whose
 * `parentFeature` + `parentCollection` matches, it:
 *
 *   1. Reads matching child docs.
 *   2. Inserts a copy into a parallel `<childCollection>.trash`
 *      collection with `deletedAt` + `trashGroup` so the 24h Mongo TTL
 *      auto-purges and `cascadeRestore` can find the cohort.
 *   3. Removes the rows from the origin collection.
 *
 * The parent doc itself is moved last so the rules' `matchByParentId`
 * can read live `parentDoc` fields (Navigation -> Sections needs
 * `parentDoc.sections`).
 *
 * Soft-delete semantics, DB-only — image files on disk are NEVER
 * touched. Image-name references travel into trash with the records.
 *
 * Transaction strategy: opportunistic. Single-node Mongo (dev) doesn't
 * support multi-doc transactions; we attempt a session and fall back
 * to sequential best-effort on the well-known replica-set error. The
 * fallback path logs each step so partial failures are diagnosable.
 *
 * No imperative cleanup code in feature delete handlers — declarative
 * rules invert the dependency. Adding a new page-scoped feature only
 * needs to declare its own rule, not edit Navigation.
 */
import {randomUUID} from 'crypto';
import type {ClientSession, Collection, Filter} from 'mongodb';
import {featureRegistry} from './featureRegistry';
import type {AnyCascadeRule, CascadeRule, DocMutateCascadeRule, FeatureContext, FeatureManifest} from './featureManifest';
import {bumpFeatureVersions} from './cacheVersion';
import {log} from './logger';

const TRASH_SUFFIX = '.trash';
const DEFAULT_TTL_SECONDS = 86_400; // 24h

function ttlSeconds(): number {
    const raw = Number(process.env.TRASH_TTL_SECONDS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_SECONDS;
}

/** Per-process memoisation: which trash collections already have the TTL index. */
const ttlIndexEnsured = new Set<string>();

async function ensureTrashIndex(coll: Collection): Promise<void> {
    const key = `${coll.dbName}.${coll.collectionName}`;
    if (ttlIndexEnsured.has(key)) return;
    try {
        await coll.createIndex({deletedAt: 1}, {expireAfterSeconds: ttlSeconds()});
        await coll.createIndex({trashGroup: 1});
        ttlIndexEnsured.add(key);
    } catch (err) {
        // Conflicting expireAfterSeconds (env value changed across boots)
        // throws; log + carry on so a stale dev TTL doesn't block the
        // actual delete.
        log.warn({scope: 'cascade.ttl', coll: key, err}, 'trash TTL index ensure failed');
    }
}

/** Test hook — reset the per-process TTL memoisation. */
export function _resetCascadeIndexCacheForTests(): void {
    ttlIndexEnsured.clear();
}

export interface CascadeDeleteResult {
    /** ULID-shaped grouping id tying every moved row together. */
    trashGroup: string;
    /** Per-collection moved-row counts. Includes the parent collection. */
    counts: Record<string, number>;
}

export interface CascadeRestoreResult {
    counts: Record<string, number>;
}

/** Resolve every `cascadeRules` entry whose parent matches the given feature/collection. */
function rulesFor(featureId: string, collection: string): AnyCascadeRule[] {
    const out: AnyCascadeRule[] = [];
    for (const f of featureRegistry as readonly FeatureManifest[]) {
        for (const rule of (f.cascadeRules ?? []) as readonly AnyCascadeRule[]) {
            if (rule.parentFeature === featureId && rule.parentCollection === collection) {
                out.push(rule);
            }
        }
    }
    return out;
}

/** Narrow a rule to `collection-move` — the default when `kind` is omitted. */
function isCollectionMove(rule: AnyCascadeRule): rule is CascadeRule {
    return rule.kind === undefined || rule.kind === 'collection-move';
}

/**
 * Compact one-line summary of a Mongo UpdateFilter for the audit log
 * — `$unset SiteSeo.pages.<slug>`, `$pull arr=...`, etc. Avoids dumping
 * the entire update object into the structured log.
 */
function summarizeUpdate(update: any): string {
    if (!update || typeof update !== 'object') return String(update);
    const parts: string[] = [];
    for (const op of Object.keys(update)) {
        const fields = Object.keys((update as any)[op] ?? {});
        if (fields.length === 0) parts.push(op);
        else parts.push(`${op} ${fields.join(',')}`);
    }
    return parts.join('; ');
}

/** Features whose `cacheVersionKeys` should bump after a cascade. */
function affectedCacheKeys(touchedCollections: readonly string[]): readonly string[] {
    const keys = new Set<string>();
    for (const f of featureRegistry as readonly FeatureManifest[]) {
        const fkeys = (f as any).cacheVersionKeys as readonly string[] | undefined;
        if (!fkeys || fkeys.length === 0) continue;
        // Heuristic: a feature whose id appears in the touched-collection
        // list (case-insensitive) is "affected". Exact matching here would
        // require a feature -> collection map we don't currently keep.
        const idLower = f.id.toLowerCase();
        if (touchedCollections.some(c => c.toLowerCase().includes(idLower) || idLower.includes(c.toLowerCase()))) {
            for (const k of fkeys) keys.add(k);
        }
    }
    return [...keys];
}

async function moveDocs(
    ctx: FeatureContext,
    fromColl: string,
    filter: Filter<any>,
    trashGroup: string,
    session: ClientSession | undefined,
): Promise<any[]> {
    const origin = ctx.db.collection(fromColl);
    const trash = ctx.db.collection(fromColl + TRASH_SUFFIX);
    await ensureTrashIndex(trash);

    const docs = await origin.find(filter, session ? {session} : {}).toArray();
    if (docs.length === 0) return [];
    const stamped = docs.map(d => ({...d, _origId: d._id, _id: undefined, deletedAt: new Date(), trashGroup}));
    // Drop `_id` so Mongo regenerates one in the trash collection — keeps
    // the original `_id` available on `_origId` for restore.
    for (const s of stamped) delete (s as any)._id;
    await trash.insertMany(stamped as any[], session ? {session} : {});
    await origin.deleteMany(filter, session ? {session} : {});
    return docs;
}

/**
 * Hard cap on recursion depth — matches the F1 server-side cap so a
 * pathological self-referential graph (Nav → Nav → Nav …) can't stall a
 * delete. A `visited` set provides cycle safety even within the cap.
 */
const MAX_DEPTH = 3;

/** Walk `cascadeRules` for a single (feature, collection, parentId) frame. */
async function processFrame(
    featureId: string,
    collection: string,
    parentId: string,
    ctx: FeatureContext,
    session: ClientSession | undefined,
    trashGroup: string,
    counts: Record<string, number>,
    depth: number,
    visited: Set<string>,
    /**
     * Pre-loaded parent doc — passed by recursion frames AFTER the
     * parent has already been moved to trash (depth > 0). At depth 0
     * we read it live; at deeper frames we trust the snapshot the
     * caller hands us, otherwise the cascade rule's `matchByParentId`
     * sees `undefined` (the moved doc no longer in the live coll)
     * and the recursion never finds grandchildren.
     */
    parentDocOverride?: any,
): Promise<void> {
    const visitKey = `${collection}:${parentId}`;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);

    const parentColl = ctx.db.collection(collection);
    const parentDoc = parentDocOverride
        ?? await parentColl.findOne({id: parentId}, session ? {session} : {});

    // Children first so rules that need `parentDoc.<field>` see the live
    // parent. Each rule may move N rows; if the child collection has its
    // own cascade rules and depth permits, recurse on each moved row.
    //
    // `collection-move` rules run first; `doc-mutate` rules apply
    // sequentially after (singleton mutation is best-effort even when
    // transactions aren't available — single-node dev path).
    const allRules = rulesFor(featureId, collection);
    const moveRules = allRules.filter(isCollectionMove);
    const docMutateRules = allRules.filter((r): r is DocMutateCascadeRule => r.kind === 'doc-mutate');

    for (const rule of moveRules) {
        try {
            const filter = rule.matchByParentId(parentId, parentDoc) as Filter<any>;
            const moved = await moveDocs(ctx, rule.childCollection, filter, trashGroup, session);
            counts[rule.childCollection] = (counts[rule.childCollection] ?? 0) + moved.length;

            // Recurse: every moved child may itself be a parent in a
            // further rule. We only have the moved doc's identity to
            // work with — re-enter `processFrame` keyed by the child
            // collection + the moved doc's `id` field. Bounded by
            // `MAX_DEPTH` and de-duped by `visited`.
            if (depth + 1 < MAX_DEPTH) {
                for (const childDoc of moved) {
                    const childId = (childDoc as any).id ?? (childDoc as any)._origId;
                    if (typeof childId !== 'string') continue;
                    await processFrame(
                        featureId,
                        rule.childCollection,
                        childId,
                        ctx,
                        session,
                        trashGroup,
                        counts,
                        depth + 1,
                        visited,
                        childDoc,
                    );
                }
            }
        } catch (err) {
            log.error({scope: 'cascade.rule', featureId, collection, parentId, child: rule.childCollection, err},
                'cascade rule failed');
            throw err;
        }
    }

    // Doc-mutate rules — apply a partial update to a singleton doc
    // (e.g. drop a `pages.<slug>` key off SiteSeo). Sequential after
    // moves; the mutation is NOT trashed/restorable. Audit each as
    // `cascade-doc-mutate` so the operation is diagnosable.
    for (const rule of docMutateRules) {
        try {
            const update = rule.buildUpdate(parentId, parentDoc);
            const target = ctx.db.collection(rule.targetCollection);
            const res = await target.updateOne(
                rule.targetFilter,
                update as any,
                session ? {session} : {},
            );
            counts[rule.targetCollection] = (counts[rule.targetCollection] ?? 0) + (res.modifiedCount ?? 0);
            log.info(
                {
                    scope: 'cascade.docMutate',
                    op: 'cascade-doc-mutate',
                    featureId,
                    parentCollection: collection,
                    parentId,
                    target: rule.targetCollection,
                    mutation: summarizeUpdate(update),
                    modified: res.modifiedCount ?? 0,
                },
                'cascade doc-mutate applied',
            );
        } catch (err) {
            log.error({scope: 'cascade.rule', featureId, collection, parentId, target: rule.targetCollection, err},
                'cascade doc-mutate rule failed');
            throw err;
        }
    }

    // Then the parent itself — only at depth 0 do we move the original
    // top-level parent through the regular path. Deeper frames have
    // already been moved by their own parent's `moveDocs` call above.
    if (depth === 0) {
        if (parentDoc) {
            const moved = await moveDocs(ctx, collection, {id: parentId}, trashGroup, session);
            counts[collection] = (counts[collection] ?? 0) + moved.length;
        } else {
            counts[collection] = 0;
        }
    }
}

async function runCascade(
    featureId: string,
    collection: string,
    parentId: string,
    ctx: FeatureContext,
    session: ClientSession | undefined,
): Promise<CascadeDeleteResult> {
    const trashGroup = randomUUID();
    const counts: Record<string, number> = {};
    const visited = new Set<string>();
    await processFrame(featureId, collection, parentId, ctx, session, trashGroup, counts, 0, visited);
    return {trashGroup, counts};
}

/**
 * Public entry point. Wraps the cascade in a Mongo transaction when
 * available; falls back to best-effort sequential mode on single-node
 * Mongo (the well-known "Transaction numbers are only allowed on a
 * replica set member or mongos" path).
 */
export async function cascadeDelete(
    featureId: string,
    collection: string,
    parentId: string,
    ctx: FeatureContext,
): Promise<CascadeDeleteResult> {
    // The driver exposes `client` via the db's reference chain; we
    // don't have a cleaner accessor in `FeatureContext` so reach for it
    // through the collection's underlying client. The cast is local;
    // the rest of the engine stays driver-agnostic.
    const client = (ctx.db as any).client ?? (ctx.db as any).s?.client;
    let result: CascadeDeleteResult | undefined;
    let txnOk = false;

    if (client && typeof client.startSession === 'function') {
        const session = client.startSession();
        try {
            await session.withTransaction(async () => {
                result = await runCascade(featureId, collection, parentId, ctx, session);
            });
            txnOk = true;
        } catch (err: any) {
            const msg = String(err?.message ?? err);
            // Single-node Mongo / non-replica-set deployments — fall
            // back to sequential best-effort.
            if (!/replica set|mongos|Transaction numbers/i.test(msg)) {
                log.warn({scope: 'cascade.txn', featureId, collection, parentId, err}, 'cascade transaction failed; falling back');
            }
        } finally {
            await session.endSession().catch(() => {/* ignore */});
        }
    }

    if (!txnOk) {
        result = await runCascade(featureId, collection, parentId, ctx, undefined);
    }

    if (!result) {
        throw new Error(`cascadeDelete: no result produced for ${featureId}/${collection}/${parentId}`);
    }

    // Bump cache-version keys for affected features so downstream
    // Caddy SWR entries evict naturally.
    const touched = Object.keys(result.counts);
    const keys = affectedCacheKeys(touched);
    if (keys.length > 0) {
        await bumpFeatureVersions(keys).catch(err =>
            log.warn({scope: 'cascade.cacheBump', err}, 'cacheBump failed'),
        );
    }

    log.info({scope: 'cascade.delete', featureId, collection, parentId, ...result}, 'cascade complete');
    return result;
}
