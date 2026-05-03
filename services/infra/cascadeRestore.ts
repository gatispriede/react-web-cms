/**
 * Cascade-restore — undo of `cascadeDelete` while the soft-delete TTL
 * window (24h by default) hasn't expired. Pulls every doc tagged with
 * the given `trashGroup` out of any `*.trash` collection, writes the
 * stripped record back to its origin collection, and deletes the
 * trash row.
 *
 * No transaction wrapping: the operation is idempotent and order-free
 * — re-running it after a partial failure just re-restores the
 * survivors. Cache-version keys for affected features bump at the end
 * so downstream Caddy SWR entries refresh.
 *
 * The trash collection name is the origin collection name + `.trash`,
 * so restore can route a doc back without consulting the cascade
 * rules. Cleaner than re-reading every feature's rule to re-derive
 * the route.
 */
import type {Filter} from 'mongodb';
import {featureRegistry} from './featureRegistry';
import type {FeatureContext, FeatureManifest} from './featureManifest';
import {bumpFeatureVersions} from './cacheVersion';
import {log} from './logger';

const TRASH_SUFFIX = '.trash';

export interface CascadeRestoreResult {
    counts: Record<string, number>;
}

/** List every `<x>.trash` collection in the current DB. */
async function listTrashCollections(ctx: FeatureContext): Promise<string[]> {
    const all = await ctx.db.listCollections({}, {nameOnly: true}).toArray();
    return all
        .map(c => c.name)
        .filter(n => n.endsWith(TRASH_SUFFIX));
}

function affectedCacheKeys(touchedCollections: readonly string[]): readonly string[] {
    const keys = new Set<string>();
    for (const f of featureRegistry as readonly FeatureManifest[]) {
        const fkeys = (f as any).cacheVersionKeys as readonly string[] | undefined;
        if (!fkeys || fkeys.length === 0) continue;
        const idLower = f.id.toLowerCase();
        if (touchedCollections.some(c => c.toLowerCase().includes(idLower) || idLower.includes(c.toLowerCase()))) {
            for (const k of fkeys) keys.add(k);
        }
    }
    return [...keys];
}

export async function cascadeRestore(
    trashGroup: string,
    ctx: FeatureContext,
): Promise<CascadeRestoreResult> {
    const counts: Record<string, number> = {};
    const trashColls = await listTrashCollections(ctx);

    for (const trashName of trashColls) {
        const originName = trashName.slice(0, -TRASH_SUFFIX.length);
        const trash = ctx.db.collection(trashName);
        const origin = ctx.db.collection(originName);
        const filter: Filter<any> = {trashGroup};
        const docs = await trash.find(filter).toArray();
        if (docs.length === 0) continue;

        const restored = docs.map(d => {
            const {_id, deletedAt, trashGroup: _tg, _origId, ...rest} = d as any;
            // Re-use the original `_id` so concurrent reads don't see a
            // duplicate-id flicker if the doc had been cached by oplog
            // tailers. Falls back to a fresh id if we never stamped one.
            return _origId ? {_id: _origId, ...rest} : rest;
        });

        try {
            await origin.insertMany(restored as any[]);
            await trash.deleteMany(filter);
            counts[originName] = (counts[originName] ?? 0) + restored.length;
        } catch (err) {
            log.error({scope: 'cascade.restore', trashGroup, originName, err}, 'restore failed for collection');
            throw err;
        }
    }

    const keys = affectedCacheKeys(Object.keys(counts));
    if (keys.length > 0) {
        await bumpFeatureVersions(keys).catch(err =>
            log.warn({scope: 'cascade.restore.cacheBump', err}, 'cacheBump failed'),
        );
    }

    log.info({scope: 'cascade.restore', trashGroup, counts}, 'cascade restore complete');
    return {counts};
}
