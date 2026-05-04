/**
 * Cascade-purge — irreversibly hard-delete every row tagged with a
 * given `trashGroup` across every `<x>.trash` collection. Sibling of
 * `cascadeRestore`, but the inverse: instead of moving rows back to
 * their origin collection, the trash rows are dropped outright.
 *
 * Used by the F8 W3 `trash.purge` MCP tool. Not callable from the
 * 24h Mongo TTL path — that path expires individual rows by
 * `deletedAt`; this is the operator-driven "I'm sure, kill it now"
 * variant.
 *
 * No restore is possible after this. Auditing happens at the caller
 * (the MCP audit wrapper); the engine itself just reports per-
 * collection counts so the operator's audit row carries the receipt.
 *
 * Single-node Mongo safe: no transactions; per-collection deleteMany
 * is independent and idempotent (re-running purges the survivors).
 */
import type {Filter} from 'mongodb';
import type {FeatureContext} from './featureManifest';
import {log} from './logger';

const TRASH_SUFFIX = '.trash';

export interface CascadePurgeResult {
    /** Per-trash-collection hard-deleted row counts. */
    counts: Record<string, number>;
}

/** List every `<x>.trash` collection in the current DB. */
async function listTrashCollections(ctx: FeatureContext): Promise<string[]> {
    const all = await ctx.db.listCollections({}, {nameOnly: true}).toArray();
    return all.map(c => c.name).filter(n => n.endsWith(TRASH_SUFFIX));
}

export async function cascadePurge(
    trashGroup: string,
    ctx: FeatureContext,
): Promise<CascadePurgeResult> {
    if (!trashGroup) throw new Error('trashGroup is required');
    const counts: Record<string, number> = {};
    const trashColls = await listTrashCollections(ctx);
    for (const trashName of trashColls) {
        try {
            const filter: Filter<any> = {trashGroup};
            const res = await ctx.db.collection(trashName).deleteMany(filter);
            const n = res.deletedCount ?? 0;
            if (n > 0) counts[trashName] = n;
        } catch (err) {
            log.error({scope: 'cascade.purge', trashGroup, trashName, err}, 'purge failed for collection');
            throw err;
        }
    }
    log.info({scope: 'cascade.purge', trashGroup, counts}, 'cascade purge complete');
    return {counts};
}
