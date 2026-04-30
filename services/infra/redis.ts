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

export interface RedisLike {
    get(key: string): Promise<string | null>;
    /** `ttlSeconds` is required — every cart write must (re)set the TTL. */
    set(key: string, value: string, ttlSeconds: number): Promise<void>;
    del(key: string): Promise<void>;
}

export class RedisAdapter implements RedisLike {
    private client: any;
    private connecting: Promise<void> | undefined;

    constructor(private readonly url?: string) {}

    private async connect(): Promise<any> {
        if (this.client && this.client.isOpen) return this.client;
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
            // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
            const nodeRequire = eval('require') as NodeJS.Require;
            const {createClient} = nodeRequire('redis');
            const client = createClient({url});
            client.on('error', (err: unknown) => console.error('[redis] client error:', err));
            await client.connect();
            this.client = client;
        })();
        try {
            await this.connecting;
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
