import type {NextApiRequest} from 'next';

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function clientIp(req: NextApiRequest | {headers: any; socket?: any}): string {
    const h = (req.headers ?? {}) as Record<string, string | string[]>;
    const fwd = h['x-forwarded-for'];
    const first = Array.isArray(fwd) ? fwd[0] : (typeof fwd === 'string' ? fwd.split(',')[0] : undefined);
    return (first?.trim() || (req as any).socket?.remoteAddress || 'unknown') as string;
}

/**
 * Simple in-memory sliding-window rate limit. Per-process only — fine for
 * dev + single-instance deploys; swap for Redis if we run multi-instance.
 * Returns `{ok: false}` when the caller should be rejected with 429.
 */
export function rateLimit(
    key: string,
    limit: number,
    windowMs: number,
): {ok: true} | {ok: false; retryAfterMs: number} {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, {count: 1, resetAt: now + windowMs});
        return {ok: true};
    }
    if (bucket.count >= limit) {
        return {ok: false, retryAfterMs: bucket.resetAt - now};
    }
    bucket.count += 1;
    return {ok: true};
}

/** Free stale buckets so the Map doesn't grow unbounded. */
export function sweepRateLimit(now = Date.now()): void {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}
