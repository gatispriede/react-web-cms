/**
 * Progressive lockout for the admin sign-in flow. Pairs with the existing
 * IP rate-limiter in `_rateLimit.ts`:
 *
 *   - rate-limit: blocks 6th request from one IP within 60s (DoS / brute-
 *     force shotguns)
 *   - lockout (this file): doubles down per (ip, email) — every consecutive
 *     wrong password starts a longer cooldown so a slow targeted attack
 *     can't just sleep ~12s between attempts and stay under the rate-limit
 *
 * Schedule (1-indexed by failure count):
 *   1 → 10s,  2 → 1m,  3 → 5m,  4 → 15m,  5+ → 30m
 *
 * `note` for the failure threshold: even one wrong password starts a 10s
 * cooldown — short enough that operators don't curse it after a typo, but
 * long enough that automated tools have to actually wait. The 30-minute
 * cap is hard; failures past N=5 keep extending the same window so an
 * attacker who's already locked out can't stack more time onto themselves
 * by hammering during the lockout (`failedDuringLock` is a no-op).
 *
 * State is in-memory and per-process. Same single-instance caveat as the
 * rate-limiter — see `auth-roles.md` ("Sign-in is rate-limited via
 * pages/api/_rateLimit.ts"). If/when we run multi-instance the bucket
 * needs to move to Redis with the rest of the gates.
 *
 * A successful login resets the bucket; a wrong password updates it. The
 * caller is expected to invoke `recordSuccess` only AFTER a confirmed
 * password match (and AFTER any other gates the auth handler enforces).
 */

interface LockoutBucket {
    /** Number of consecutive wrong-password attempts. Reset on success. */
    failures: number;
    /** Epoch ms — caller is locked until this time. 0 if not locked. */
    lockedUntil: number;
    /** Bookkeeping — last time the bucket was touched, used by the sweeper
     *  to prune stale buckets so the Map doesn't grow unbounded. */
    touchedAt: number;
}

// Cooldown durations in ms. `THRESHOLDS[i]` applies after `i+1` failures.
// After we run off the end of the array, `MAX_LOCKOUT` applies.
const THRESHOLDS_MS = [
    10_000,        // 10s after 1st miss
    60_000,        // 1m after 2nd
    5 * 60_000,    // 5m after 3rd
    15 * 60_000,   // 15m after 4th
    30 * 60_000,   // 30m after 5th
];
const MAX_LOCKOUT_MS = 30 * 60_000;
// Buckets older than this with no recent activity are reaped. Two hours
// covers the longest lockout window plus a buffer for the user to come
// back, type the password right, and reset the counter naturally.
const BUCKET_TTL_MS = 2 * 60 * 60_000;

const buckets = new Map<string, LockoutBucket>();

const cooldownFor = (failures: number): number => {
    if (failures <= 0) return 0;
    const idx = Math.min(failures - 1, THRESHOLDS_MS.length - 1);
    return THRESHOLDS_MS[idx] ?? MAX_LOCKOUT_MS;
};

/**
 * Build the bucket key. Email is lowercased so case-different attempts
 * (`Admin@` vs `admin@`) share the same lockout — otherwise an attacker
 * could rotate casing to multiply their attempt budget.
 */
export function lockoutKey(ip: string, email: string): string {
    return `${ip}|${(email || '').trim().toLowerCase()}`;
}

/**
 * Check the bucket BEFORE doing the password compare. If locked, returns
 * the remaining wait. Caller should bail with an error that quotes the
 * wait so the operator sees a useful message, not a generic "wrong
 * password".
 */
export function checkLockout(key: string): {ok: true} | {ok: false; retryAfterMs: number} {
    const bucket = buckets.get(key);
    if (!bucket) return {ok: true};
    const now = Date.now();
    if (bucket.lockedUntil > now) {
        return {ok: false, retryAfterMs: bucket.lockedUntil - now};
    }
    return {ok: true};
}

/**
 * Bump the failure count and (re)compute the lock window. Returns the
 * fresh lock window so the caller can include it in the error surfaced to
 * the user. Failing while already locked is a no-op for the counter — we
 * don't reward attackers for keeping the connection warm.
 */
export function recordFailure(key: string): {failures: number; retryAfterMs: number} {
    const now = Date.now();
    const existing = buckets.get(key);
    if (existing && existing.lockedUntil > now) {
        // Already locked; don't escalate further during the active window
        // (otherwise a script keeps hammering and stacks 30m onto itself
        // forever). Just refresh `touchedAt` so the sweeper doesn't reap.
        existing.touchedAt = now;
        return {failures: existing.failures, retryAfterMs: existing.lockedUntil - now};
    }
    const failures = (existing?.failures ?? 0) + 1;
    const retryAfterMs = cooldownFor(failures);
    buckets.set(key, {
        failures,
        lockedUntil: now + retryAfterMs,
        touchedAt: now,
    });
    return {failures, retryAfterMs};
}

/**
 * Clear the bucket — call after a confirmed password match so the next
 * sign-in (after, e.g., signing out) starts from a clean slate.
 */
export function recordSuccess(key: string): void {
    buckets.delete(key);
}

/** Free stale buckets so the Map doesn't grow unbounded. */
export function sweepLockouts(now = Date.now()): void {
    for (const [key, bucket] of buckets) {
        if (bucket.lockedUntil <= now && now - bucket.touchedAt > BUCKET_TTL_MS) {
            buckets.delete(key);
        }
    }
}

/** Format a ms duration as a human-readable wait, e.g. "10 seconds",
 *  "1 minute", "5 minutes". Used to compose the error message. */
export function formatWait(ms: number): string {
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'}`;
    const min = Math.ceil(sec / 60);
    return `${min} minute${min === 1 ? '' : 's'}`;
}

// Test-only — clears state between unit tests.
export function _resetLockoutsForTests(): void {
    buckets.clear();
}
