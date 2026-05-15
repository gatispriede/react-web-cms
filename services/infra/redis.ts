/**
 * Tiny `RedisLike` adapter for the cart module.
 *
 * The `redis` (node-redis) v5 client is heavy and async-connection-bound.
 * For the cart's narrow usage (single-key get/set/del with a TTL) we
 * expose a minimal interface that:
 *   - lets unit tests swap in an in-memory Map without pulling
 *     `ioredis-mock` (no new dependency); and
 *   - hides node-redis's `EX` / `expireAt` ceremony from CartService.
 *
 * The real `RedisAdapter` lazily connects on first use and reconnects
 * on disconnect. Production wiring lives in mongoDBConnection.ts.
 */
// `redis` is intentionally NOT statically imported — Turbopack/webpack
// resolve `@redis/client/dist/lib/utils/digest.js`'s dynamic `@node-rs/xxhash`
// import eagerly during browser-bundle analysis and fail the build, even
// though this module only runs server-side. Dynamic require keeps it off
// the client graph.
type RedisClientType = unknown;

import {log} from '@services/infra/logger';

export interface RedisLike {
    get(key: string): Promise<string | null>;
    /** `ttlSeconds` is required — every cart write must (re)set the TTL. */
    set(key: string, value: string, ttlSeconds: number): Promise<void>;
    del(key: string): Promise<void>;
}

export class RedisAdapter implements RedisLike {
    private client: any;
    private connecting: Promise<void> | undefined;
    /** Sticky failure: once a connect attempt times out, every subsequent
     *  call rejects immediately so the consumer's catch-and-fall-through
     *  path runs without a per-call socket retry. node-redis@4's default
     *  reconnect loop will otherwise keep the socket open in the
     *  background and freshly issued `get()`s sit on `client.connect()`
     *  forever when there's no Redis server listening. */
    private failed = false;
    private static readonly CONNECT_TIMEOUT_MS = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 1000;

    constructor(private readonly url?: string) {}

    private async connect(): Promise<any> {
        if (this.client && this.client.isOpen) return this.client;
        if (this.failed) throw new Error('redis unreachable');
        if (this.connecting) {
            await this.connecting;
            if (this.client) return this.client;
        }
        this.connecting = (async () => {
            // DECISION: prefer a single REDIS_URL env var over the legacy
            // username/password/host config so dev/CI/Docker share one
            // shape. Falls back to localhost for `next dev`.
            const url = this.url ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
            // Dynamic require keeps `redis` off the client bundle graph;
            // bundlers won't statically resolve `eval('require')`.

            const nodeRequire = eval('require') as NodeJS.Require;
            const {createClient} = nodeRequire('redis');
            const client = createClient({
                url,
                // Bounded connect timeout — without this, node-redis sits
                // on a TCP connect indefinitely when Redis isn't running
                // (common on dev machines that haven't started the
                // optional cart-redis service). That stalls every
                // mutation that flows through the idempotency wrapper
                // (`removeUser`, page trash delete, etc.) because the
                // wrapper calls `redis.get()` first.
                socket: {connectTimeout: RedisAdapter.CONNECT_TIMEOUT_MS, reconnectStrategy: false as any},
            });
            client.on('error', (err: unknown) => log.error({scope: 'redis.client', err}, 'redis client error'));
            // Hard ceiling around `client.connect()` itself — belt-and-
            // braces over `socket.connectTimeout` in case the driver
            // hands back a promise that never settles for some reason
            // (DNS lookup, TLS handshake, etc).
            await Promise.race([
                client.connect(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`redis connect timed out after ${RedisAdapter.CONNECT_TIMEOUT_MS}ms`)), RedisAdapter.CONNECT_TIMEOUT_MS),
                ),
            ]);
            this.client = client;
        })();
        try {
            await this.connecting;
        } catch (err) {
            // Trip the sticky-fail flag so the next caller bounces
            // immediately instead of retrying the socket.
            this.failed = true;
            log.warn({scope: 'redis.connect', err}, 'redis unreachable; cache backends will fall through');
            throw err;
        } finally {
            this.connecting = undefined;
        }
        return this.client!;
    }

    async get(key: string): Promise<string | null> {
        const c = await this.connect();
        return c.get(key);
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        const c = await this.connect();
        await c.set(key, value, {EX: Math.max(1, Math.floor(ttlSeconds))});
    }

    async del(key: string): Promise<void> {
        const c = await this.connect();
        await c.del(key);
    }
}

/** In-memory `RedisLike` — used by tests and as a safe fallback. */
export class InMemoryRedis implements RedisLike {
    private store = new Map<string, {value: string; expiresAt: number}>();

    async get(key: string): Promise<string | null> {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiresAt < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        this.store.set(key, {value, expiresAt: Date.now() + ttlSeconds * 1000});
    }

    async del(key: string): Promise<void> {
        this.store.delete(key);
    }

    /** Test-only — returns the raw TTL remaining in seconds, or -1 if absent. */
    _ttl(key: string): number {
        const entry = this.store.get(key);
        if (!entry) return -1;
        return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    }
}
