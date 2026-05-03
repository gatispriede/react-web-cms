/**
 * Server-side mutation idempotency keys (F2 Part A — backend half).
 *
 * Every destructive mutation may accept an optional `idempotencyKey`. The
 * caller (admin UI, MCP tool, REST adapter) generates a UUIDv4 per user
 * click; replays of the same key inside the TTL window collapse to a
 * single execution and return the original response unchanged.
 *
 * Storage shape: a single Redis key per idempotency key at
 * `idempotency:<key>` holding the JSON-serialised response. TTL 5 min
 * (300s), tunable via `process.env.IDEMPOTENCY_TTL_SECONDS`. Falls back
 * to a Mongo `Idempotency` collection with a TTL index on `expiresAt`
 * when Redis isn't available (single-node dev / tests). The fallback is
 * process-local for tests and shared-cluster-wide for prod-on-Mongo.
 *
 * Concurrency: a per-process `inFlight` map of `Promise<response>`s
 * collapses the N-concurrent-callers-with-same-key case down to one
 * underlying executor invocation. The first arrival owns the work; the
 * rest await the same promise. After resolution the response is also
 * persisted so a *later* (post-fan-in) replay still hits cache.
 *
 * Empty / undefined key → cache-miss every time. The caller chose not
 * to participate; we don't throw.
 */
import type {RedisLike} from './redis';
import {InMemoryRedis} from './redis';
import {log} from './logger';

const KEY_PREFIX = 'idempotency:';
const DEFAULT_TTL_SECONDS = 300;

function ttlSeconds(): number {
    const raw = process.env.IDEMPOTENCY_TTL_SECONDS;
    if (!raw) return DEFAULT_TTL_SECONDS;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TTL_SECONDS;
}

/**
 * Minimal Mongo-shaped backend: enough to store `{key, response,
 * expiresAt}` rows and read them back by key. The real implementation
 * is a thin wrapper over a `Db.collection('Idempotency')` handle; tests
 * pass an in-memory shim that respects `expiresAt`.
 */
export interface IdempotencyMongoLike {
    findByKey(key: string): Promise<{response: unknown; expiresAt: Date} | null>;
    upsert(key: string, response: unknown, expiresAt: Date): Promise<void>;
}

export type IdempotencyResult =
    | {cached: true; response: unknown}
    | {cached: false};

/**
 * Build a Mongo-backed `IdempotencyMongoLike` from a `Db` handle. Lazy:
 * the first write ensures the TTL index on `expiresAt` exists.
 */
export function mongoIdempotencyBackend(db: {collection: (name: string) => any}): IdempotencyMongoLike {
    let indexEnsured = false;
    const col = () => db.collection('Idempotency');
    async function ensureIndex(): Promise<void> {
        if (indexEnsured) return;
        try { await col().createIndex({expiresAt: 1}, {expireAfterSeconds: 0}); }
        catch (err) { log.warn({scope: 'idempotency.index', err}, 'TTL index ensure failed'); }
        indexEnsured = true;
    }
    return {
        async findByKey(key) {
            const doc = await col().findOne({_id: key});
            if (!doc) return null;
            // Mongo's TTL monitor runs once a minute; honour `expiresAt`
            // ourselves so reads between sweeps still see expiry.
            if (doc.expiresAt instanceof Date && doc.expiresAt.getTime() < Date.now()) return null;
            return {response: doc.response, expiresAt: doc.expiresAt};
        },
        async upsert(key, response, expiresAt) {
            await ensureIndex();
            await col().updateOne(
                {_id: key},
                {$set: {_id: key, response, expiresAt}},
                {upsert: true},
            );
        },
    };
}

/** In-memory `IdempotencyMongoLike` — used by the fallback path in tests. */
export class InMemoryIdempotencyMongo implements IdempotencyMongoLike {
    private store = new Map<string, {response: unknown; expiresAt: Date}>();
    async findByKey(key: string) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiresAt.getTime() < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return entry;
    }
    async upsert(key: string, response: unknown, expiresAt: Date) {
        this.store.set(key, {response, expiresAt});
    }
}

export class IdempotencyService {
    private readonly inFlight = new Map<string, Promise<unknown>>();

    constructor(
        private readonly redis: RedisLike | null,
        private readonly mongo: IdempotencyMongoLike | null,
    ) {}

    private redisKey(key: string): string { return KEY_PREFIX + key; }

    /**
     * Read-side: returns the cached response if the key has been seen
     * inside the TTL, otherwise signals a miss. Empty / undefined keys
     * always miss.
     */
    async check(key: string | undefined | null): Promise<IdempotencyResult> {
        if (!key) return {cached: false};
        // 1. In-flight collapse: if a request with this key is currently
        //    executing in this process, await its result.
        const pending = this.inFlight.get(key);
        if (pending) {
            try {
                const response = await pending;
                return {cached: true, response};
            } catch {
                // Original execution failed; treat as miss so the next
                // arrival can re-execute. Failures are *not* memoised.
                return {cached: false};
            }
        }
        // 2. Persistent cache.
        if (this.redis) {
            try {
                const raw = await this.redis.get(this.redisKey(key));
                if (raw) return {cached: true, response: JSON.parse(raw)};
            } catch (err) {
                log.warn({scope: 'idempotency.redis.get', err}, 'redis get failed; falling through');
            }
        }
        if (this.mongo) {
            try {
                const hit = await this.mongo.findByKey(key);
                if (hit) return {cached: true, response: hit.response};
            } catch (err) {
                log.warn({scope: 'idempotency.mongo.find', err}, 'mongo find failed; treating as miss');
            }
        }
        return {cached: false};
    }

    /**
     * Write-side: persist a response under `key` so subsequent `check`s
     * within the TTL hit cache. No-op for empty keys.
     */
    async store(key: string | undefined | null, response: unknown): Promise<void> {
        if (!key) return;
        const ttl = ttlSeconds();
        const expiresAt = new Date(Date.now() + ttl * 1000);
        const json = JSON.stringify(response);
        if (this.redis) {
            try {
                await this.redis.set(this.redisKey(key), json, ttl);
                return;
            } catch (err) {
                log.warn({scope: 'idempotency.redis.set', err}, 'redis set failed; falling back to mongo');
            }
        }
        if (this.mongo) {
            try {
                await this.mongo.upsert(key, response, expiresAt);
            } catch (err) {
                log.warn({scope: 'idempotency.mongo.upsert', err}, 'mongo upsert failed (non-fatal)');
            }
        }
    }

    /**
     * The full check-or-execute dance, exposed as one call so callers
     * (`runMutation`) get the in-flight collapse for free. Failures
     * propagate; only successful responses are memoised.
     */
    async checkOrRun<T>(key: string | undefined | null, fn: () => Promise<T>): Promise<T> {
        if (!key) return fn();
        // Synchronous in-flight collapse first — registering BEFORE we
        // hit any awaits ensures concurrent arrivals (within the same
        // tick) all see the same promise. Only after we've claimed the
        // slot do we consult the persistent stores.
        const existing = this.inFlight.get(key);
        if (existing) {
            try { return await existing as T; }
            catch { /* failures aren't memoised — fall through to fresh exec */ }
        }
        const exec = (async () => {
            const hit = await this.check(key);
            if (hit.cached) return hit.response as T;
            const result = await fn();
            await this.store(key, result);
            return result;
        })();
        this.inFlight.set(key, exec);
        try {
            return await exec as T;
        } finally {
            this.inFlight.delete(key);
        }
    }
}

// Module-level default — wired at boot from `mongoDBConnection`. Tests
// can override via `setIdempotencyService`.
let defaultService: IdempotencyService = new IdempotencyService(null, new InMemoryIdempotencyMongo());

export function setIdempotencyService(svc: IdempotencyService): void {
    defaultService = svc;
}

export function getIdempotencyService(): IdempotencyService {
    return defaultService;
}

/** Test hook — restore the in-memory default. */
export function _resetIdempotencyForTests(): void {
    defaultService = new IdempotencyService(null, new InMemoryIdempotencyMongo());
}
