import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {
    _resetLockoutsForTests,
    checkLockout,
    formatWait,
    lockoutKey,
    recordFailure,
    recordSuccess,
    sweepLockouts,
} from '../../../pages/api/_loginLockout';

beforeEach(() => { vi.useFakeTimers(); _resetLockoutsForTests(); });
afterEach(() => { vi.useRealTimers(); sweepLockouts(Date.now() + 10_000_000); });

describe('login lockout', () => {
    it('first failure locks out for ~10s', () => {
        const k = lockoutKey('1.2.3.4', 'foo@example.com');
        const r = recordFailure(k);
        expect(r.failures).toBe(1);
        expect(r.retryAfterMs).toBe(10_000);
        const c = checkLockout(k);
        expect(c.ok).toBe(false);
        if (!c.ok) expect(c.retryAfterMs).toBeLessThanOrEqual(10_000);
    });

    it('schedule escalates 10s → 1m → 5m → 15m → 30m and caps at 30m', () => {
        const k = lockoutKey('1.2.3.4', 'a@x');
        const expected = [10_000, 60_000, 5*60_000, 15*60_000, 30*60_000, 30*60_000, 30*60_000];
        for (const ms of expected) {
            // Walk past the active lock so the next failure is allowed to escalate.
            vi.advanceTimersByTime(31 * 60_000);
            const r = recordFailure(k);
            expect(r.retryAfterMs).toBe(ms);
        }
    });

    it('failing during an active lock does not stack more time', () => {
        const k = lockoutKey('1.2.3.4', 'a@x');
        recordFailure(k);                  // 10s lock
        const second = recordFailure(k);   // still inside the 10s window
        expect(second.failures).toBe(1);   // counter not bumped
        expect(second.retryAfterMs).toBeLessThanOrEqual(10_000);
    });

    it('check returns ok once the lock expires', () => {
        const k = lockoutKey('1.2.3.4', 'a@x');
        recordFailure(k);
        expect(checkLockout(k).ok).toBe(false);
        vi.advanceTimersByTime(11_000);
        expect(checkLockout(k).ok).toBe(true);
    });

    it('successful sign-in resets the bucket', () => {
        const k = lockoutKey('1.2.3.4', 'a@x');
        recordFailure(k);
        recordFailure(k); // would be 1m next
        recordSuccess(k);
        // Walk past the 10s window so we know the second failure starts fresh.
        vi.advanceTimersByTime(11_000);
        const r = recordFailure(k);
        expect(r.failures).toBe(1);
        expect(r.retryAfterMs).toBe(10_000);
    });

    it('email casing does not multiply the budget', () => {
        const k1 = lockoutKey('1.2.3.4', 'Admin@Example.com');
        const k2 = lockoutKey('1.2.3.4', 'admin@example.com');
        expect(k1).toBe(k2);
    });
});

describe('formatWait', () => {
    it('renders seconds for sub-minute waits', () => {
        expect(formatWait(10_000)).toBe('10 seconds');
        expect(formatWait(1_000)).toBe('1 second');
    });
    it('renders minutes for >= 60s waits, ceiling', () => {
        expect(formatWait(60_000)).toBe('1 minute');
        expect(formatWait(61_000)).toBe('2 minutes');
        expect(formatWait(30 * 60_000)).toBe('30 minutes');
    });
});
