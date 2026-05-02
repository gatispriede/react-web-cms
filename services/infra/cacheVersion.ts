/**
 * Per-feature cache-version stamps backed by Redis.
 *
 * Combined with `bootId` (process-scoped UUID) and Caddy SWR, these
 * stamps form the cache key for public responses. The cache-key shape
 * is `<bootId>:<feature>=<version>[,<feature>=<version>…]`. A restart
 * bumps `bootId`, an admin write bumps the relevant feature version —
 * either path invalidates downstream Caddy entries without flushing.
 *
 * Storage: a single integer per feature in Redis at
 * `cms:cv:<feature>`. Atomic INCR via the underlying `RedisLike`'s
 * `set(get+1)` is fine here — versions are advisory; a torn read
 * just means one extra Caddy miss, not a correctness bug.
 *
 * Falls back to an in-memory map when no Redis is configured (dev,
 * tests). The fallback is process-local; restart bumps everything via
 * `bootId` anyway, so no cross-process coherence is required.
 */
import type {RedisLike} from './redis';
import {InMemoryRedis} from './redis';

const KEY_PREFIX = 'cms:cv:';

let backend: RedisLike = new InMemoryRedis();

/**
 * Wire the production Redis adapter. Called once at boot from the
 * connection layer; tests can re-bind to an `InMemoryRedis` for
 * deterministic round-trips.
 */
export function setCacheVersionBackend(redis: RedisLike): void {
    backend = redis;
}

/** Current version stamp for a feature. Returns 0 if never bumped. */
export async function getFeatureVersion(feature: string): Promise<number> {
    const raw = await backend.get(KEY_PREFIX + feature);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Atomically bump a feature's version. Reads the current value,
 * increments, writes back with a long TTL (30d) so an idle entry
 * doesn't pin Redis memory forever.
 */
export async function bumpFeatureVersion(feature: string): Promise<number> {
    const current = await getFeatureVersion(feature);
    const next = current + 1;
    await backend.set(KEY_PREFIX + feature, String(next), 60 * 60 * 24 * 30);
    return next;
}

/** Bump a batch of features in one call. Order is stable for log forensics. */
export async function bumpFeatureVersions(features: readonly string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const f of [...features].sort()) {
        out[f] = await bumpFeatureVersion(f);
    }
    return out;
}

/**
 * Read a snapshot of versions for a list of features. Used by the
 * cache-header builder to stamp the `X-Cms-Cache-Tag` on outgoing
 * responses.
 */
export async function getFeatureVersions(features: readonly string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const f of features) out[f] = await getFeatureVersion(f);
    return out;
}

/** Test hook — clears the in-memory backend. No-op against real Redis. */
export function _resetCacheVersionsForTests(): void {
    backend = new InMemoryRedis();
}
