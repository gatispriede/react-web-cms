import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {InMemoryRedis} from '@services/infra/redis';
import {
    IdempotencyService,
    InMemoryIdempotencyMongo,
} from '@services/infra/idempotency';

describe('IdempotencyService', () => {
    afterEach(() => {
        vi.useRealTimers();
        delete process.env.IDEMPOTENCY_TTL_SECONDS;
    });

    describe('Redis-backed path', () => {
        let redis: InMemoryRedis;
        let svc: IdempotencyService;
        beforeEach(() => {
            redis = new InMemoryRedis();
            svc = new IdempotencyService(redis, null);
        });

        it('miss → executor runs → subsequent check hits cache', async () => {
            expect(await svc.check('k1')).toEqual({cached: false});
            const exec = vi.fn(async () => ({ok: true, n: 1}));
            const r1 = await svc.checkOrRun('k1', exec);
            expect(r1).toEqual({ok: true, n: 1});
            const hit = await svc.check('k1');
            expect(hit).toEqual({cached: true, response: {ok: true, n: 1}});
            // Second checkOrRun must not invoke the executor again.
            const r2 = await svc.checkOrRun('k1', exec);
            expect(r2).toEqual({ok: true, n: 1});
            expect(exec).toHaveBeenCalledTimes(1);
        });

        it('50 concurrent calls with the same key → executor runs once', async () => {
            const exec = vi.fn(async () => {
                // simulate a tiny IO delay so collapses are exercised
                await new Promise(r => setTimeout(r, 5));
                return {payload: 'one'};
            });
            const results = await Promise.all(
                Array.from({length: 50}, () => svc.checkOrRun('same', exec)),
            );
            expect(exec).toHaveBeenCalledTimes(1);
            for (const r of results) expect(r).toEqual({payload: 'one'});
        });

        it('different keys do not collide', async () => {
            const a = vi.fn(async () => 'A');
            const b = vi.fn(async () => 'B');
            const [ra, rb] = await Promise.all([
                svc.checkOrRun('a', a),
                svc.checkOrRun('b', b),
            ]);
            expect(ra).toBe('A');
            expect(rb).toBe('B');
            expect(a).toHaveBeenCalledTimes(1);
            expect(b).toHaveBeenCalledTimes(1);
        });

        it('undefined / empty keys are no-op cache-misses', async () => {
            const exec = vi.fn(async () => 42);
            expect(await svc.check(undefined)).toEqual({cached: false});
            expect(await svc.check('')).toEqual({cached: false});
            await svc.store(undefined, {anything: true});
            await svc.store('', {anything: true});
            const r1 = await svc.checkOrRun(undefined, exec);
            const r2 = await svc.checkOrRun('', exec);
            expect(r1).toBe(42);
            expect(r2).toBe(42);
            // Always re-runs because nothing was memoised.
            expect(exec).toHaveBeenCalledTimes(2);
        });

        it('TTL expiry: store, advance time, check → miss', async () => {
            process.env.IDEMPOTENCY_TTL_SECONDS = '60';
            const start = Date.now();
            vi.useFakeTimers({shouldAdvanceTime: true});
            vi.setSystemTime(start);
            await svc.store('exp', {v: 1});
            expect(await svc.check('exp')).toEqual({cached: true, response: {v: 1}});
            vi.setSystemTime(start + 61_000);
            expect(await svc.check('exp')).toEqual({cached: false});
        });

        it('failures are not memoised — next caller re-executes', async () => {
            const exec = vi.fn()
                .mockRejectedValueOnce(new Error('boom'))
                .mockResolvedValueOnce('ok');
            await expect(svc.checkOrRun('flaky', exec as any)).rejects.toThrow('boom');
            const r = await svc.checkOrRun('flaky', exec as any);
            expect(r).toBe('ok');
            expect(exec).toHaveBeenCalledTimes(2);
        });
    });

    describe('Mongo fallback path (Redis unavailable)', () => {
        let mongo: InMemoryIdempotencyMongo;
        let svc: IdempotencyService;
        beforeEach(() => {
            mongo = new InMemoryIdempotencyMongo();
            svc = new IdempotencyService(null, mongo);
        });

        it('round-trips check/store via mongo', async () => {
            const exec = vi.fn(async () => ({mongoed: true}));
            const r = await svc.checkOrRun('m1', exec);
            expect(r).toEqual({mongoed: true});
            const hit = await svc.check('m1');
            expect(hit).toEqual({cached: true, response: {mongoed: true}});
            const r2 = await svc.checkOrRun('m1', exec);
            expect(r2).toEqual({mongoed: true});
            expect(exec).toHaveBeenCalledTimes(1);
        });

        it('50 concurrent calls collapse to one execution', async () => {
            const exec = vi.fn(async () => {
                await new Promise(r => setTimeout(r, 5));
                return 'mongo-once';
            });
            const results = await Promise.all(
                Array.from({length: 50}, () => svc.checkOrRun('mk', exec)),
            );
            expect(exec).toHaveBeenCalledTimes(1);
            for (const r of results) expect(r).toBe('mongo-once');
        });

        it('TTL expiry honoured by InMemoryIdempotencyMongo', async () => {
            process.env.IDEMPOTENCY_TTL_SECONDS = '30';
            const start = Date.now();
            vi.useFakeTimers({shouldAdvanceTime: true});
            vi.setSystemTime(start);
            await svc.store('me', {v: 7});
            expect(await svc.check('me')).toEqual({cached: true, response: {v: 7}});
            vi.setSystemTime(start + 31_000);
            expect(await svc.check('me')).toEqual({cached: false});
        });

        it('different keys do not collide', async () => {
            await svc.store('x', 1);
            await svc.store('y', 2);
            expect(await svc.check('x')).toEqual({cached: true, response: 1});
            expect(await svc.check('y')).toEqual({cached: true, response: 2});
            expect(await svc.check('z')).toEqual({cached: false});
        });
    });

    describe('Redis-failure resilience', () => {
        it('falls through to mongo when redis throws', async () => {
            const failingRedis = {
                get: vi.fn(async () => { throw new Error('redis down'); }),
                set: vi.fn(async () => { throw new Error('redis down'); }),
                del: vi.fn(async () => {}),
            };
            const mongo = new InMemoryIdempotencyMongo();
            const svc = new IdempotencyService(failingRedis, mongo);
            const exec = vi.fn(async () => 'fallback');
            const r1 = await svc.checkOrRun('rf', exec);
            expect(r1).toBe('fallback');
            // After the in-flight clears, the cached value lives in mongo.
            const hit = await svc.check('rf');
            expect(hit).toEqual({cached: true, response: 'fallback'});
        });
    });
});
