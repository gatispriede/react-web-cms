import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {rateLimit, clientIp, sweepRateLimit} from '../../../pages/api/_rateLimit';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); sweepRateLimit(Date.now() + 10_000_000); });

describe('rateLimit', () => {
    it('lets the first N requests through, blocks the (N+1)th with retryAfter', () => {
        const key = `test-${Math.random()}`;
        expect(rateLimit(key, 3, 1000)).toEqual({ok: true});
        expect(rateLimit(key, 3, 1000)).toEqual({ok: true});
        expect(rateLimit(key, 3, 1000)).toEqual({ok: true});
        const blocked = rateLimit(key, 3, 1000);
        expect(blocked.ok).toBe(false);
        expect((blocked as any).retryAfterMs).toBeGreaterThan(0);
    });

    it('resets the bucket after the window expires', () => {
        const key = `test-${Math.random()}`;
        rateLimit(key, 1, 1000);
        expect(rateLimit(key, 1, 1000).ok).toBe(false);
        vi.advanceTimersByTime(1001);
        expect(rateLimit(key, 1, 1000).ok).toBe(true);
    });
});

describe('clientIp', () => {
    it('prefers the first X-Forwarded-For entry', () => {
        const ip = clientIp({headers: {'x-forwarded-for': '203.0.113.5, 10.0.0.1'}, socket: {remoteAddress: '127.0.0.1'}} as any);
        expect(ip).toBe('203.0.113.5');
    });

    it('falls back to socket.remoteAddress when no forwarded header', () => {
        const ip = clientIp({headers: {}, socket: {remoteAddress: '10.0.0.42'}} as any);
        expect(ip).toBe('10.0.0.42');
    });

    it('returns "unknown" when nothing identifies the caller', () => {
        const ip = clientIp({headers: {}} as any);
        expect(ip).toBe('unknown');
    });
});
