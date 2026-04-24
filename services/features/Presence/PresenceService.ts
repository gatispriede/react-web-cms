import {Collection, Db} from 'mongodb';

let _db: Db | null = null;

/**
 * Layer 2 of multi-admin conflict mitigation: informational presence.
 *
 * Every active editor heartbeats `{email, docId, at}` to Mongo every ~15 s;
 * the UI polls `list({docId})` on the same cadence and renders avatars of
 * peers editing the same `docId`. Unlike Layer 1 (optimistic concurrency
 * on save), this layer surfaces the "someone else is here" signal
 * **before** the editor hits save, so the conflict dialog becomes a rare
 * fallback rather than the primary notification.
 *
 * Storage choices:
 *   - TTL index on `at` (45 s) automatically evicts stale entries without
 *     us needing a sweeper. A peer that closes their tab falls off every
 *     listener's radar within ~1 TTL cycle.
 *   - `{email, docId}` composite index keeps the upsert on heartbeat O(1)
 *     and prevents duplicate rows when a tab re-opens.
 *   - `docId` is caller-scoped — we don't enforce a shape. Current admin
 *     wiring uses the current admin route path (`/en/admin`, `/en/admin/settings`
 *     etc.) which is coarse but mirrors the "what page are you on?" signal
 *     editors actually care about. Finer-grained docIds (per-theme, per-post)
 *     can be wired later by passing them through the same heartbeat channel.
 *
 * Self-entries are kept in the result set — the client filters them out
 * by email. Dropping them server-side would hide "me on another device"
 * which is still useful signal.
 */
export interface PresenceEntry {
    email: string;
    docId: string;
    at: Date;
    /** Optional display name / avatar seed; the UI fallbacks to email if absent. */
    name?: string;
}

// Keep TTL at ~2× the client poll interval so a single missed heartbeat
// doesn't make a peer blink out. Client polls at 45 s → 90 s TTL gives
// one grace window for a flaky mobile network without surfacing ghosts.
const TTL_SECONDS = 90;

// Server-side debounce window for heartbeat writes. If the same
// {email, docId} heartbeated within this many ms we skip the upsert —
// the existing doc's `at` is still within TTL, so peers don't blink
// out, and Mongo doesn't get hammered when multiple tabs of the same
// admin user heartbeat concurrently.
const HEARTBEAT_DEBOUNCE_MS = 10_000;

export class PresenceService {
    private presenceDB: Collection;
    private indexesReady = false;

    constructor(db: Db) {
        this.presenceDB = db.collection('Presence');
        _db = db;
    }

    private async ensureIndexes(): Promise<void> {
        if (this.indexesReady) return;
        try {
            await this.presenceDB.createIndex({email: 1, docId: 1}, {unique: true});
            await this.presenceDB.createIndex({at: 1}, {expireAfterSeconds: TTL_SECONDS});
            // Existing deployments created the TTL at 45 s. If the
            // constant has since been bumped (currently 90 s) Mongo
            // ignores the change on `createIndex` — it silently keeps
            // the old expiry. `collMod` is the documented way to edit
            // an existing TTL in place without a drop-recreate dance.
            try {
                if (_db) {
                    await _db.command({
                        collMod: 'Presence',
                        index: {keyPattern: {at: 1}, expireAfterSeconds: TTL_SECONDS},
                    });
                }
            } catch { /* older Mongo / permissions — non-fatal */ }
            this.indexesReady = true;
        } catch (err) {
            // Index creation is idempotent; a concurrent setup may have
            // raced us. Swallow and try again on the next call so a
            // transient Mongo blip doesn't disable presence forever.
            console.error('PresenceService.ensureIndexes:', err);
        }
    }

    async heartbeat({email, docId, name}: {email: string; docId: string; name?: string}): Promise<void> {
        if (!email || !docId) return;
        await this.ensureIndexes();
        const now = new Date();
        // Conditional upsert: only write if the last heartbeat for this
        // {email, docId} is older than the debounce window. Mongo's
        // filter-based update makes this atomic — a racing writer won't
        // double-write. If the filter doesn't match we fall back to an
        // upsert so the very first heartbeat still creates the row.
        const cutoff = new Date(now.getTime() - HEARTBEAT_DEBOUNCE_MS);
        const updated = await this.presenceDB.updateOne(
            {email, docId, at: {$lt: cutoff}},
            {$set: {email, docId, name, at: now}},
        );
        if (updated.matchedCount === 0 && updated.upsertedCount === 0) {
            // Either the row is fresh (skip, already inside the debounce
            // window) or doesn't exist yet (create it).
            await this.presenceDB.updateOne(
                {email, docId},
                {$setOnInsert: {email, docId, name, at: now}},
                {upsert: true},
            );
        }
    }

    async list({docId}: {docId: string}): Promise<PresenceEntry[]> {
        if (!docId) return [];
        await this.ensureIndexes();
        // Use a fresh cutoff in case the TTL sweeper hasn't caught up yet —
        // the UI should never show a peer that hasn't heartbeated in well
        // over the poll interval, regardless of index lag.
        const cutoff = new Date(Date.now() - (TTL_SECONDS + 5) * 1000);
        const docs = await this.presenceDB
            .find({docId, at: {$gt: cutoff}})
            .sort({at: -1})
            .limit(50)
            .toArray();
        return docs.map(d => ({
            email: (d as any).email,
            docId: (d as any).docId,
            name: (d as any).name,
            at: (d as any).at,
        }));
    }

    async clear({email, docId}: {email: string; docId: string}): Promise<void> {
        if (!email || !docId) return;
        try {
            await this.presenceDB.deleteOne({email, docId});
        } catch (err) {
            console.error('PresenceService.clear:', err);
        }
    }
}
