import {describe, expect, it, vi} from 'vitest';
import {BatchLoader} from '@services/infra/BatchLoader';

describe('BatchLoader', () => {
    it('folds three concurrent loads into one backend call', async () => {
        const fn = vi.fn(async (ids: readonly string[]) =>
            ids.map(id => ({id, name: `n-${id}`})));
        const loader = new BatchLoader(fn);

        const [a, b, c] = await Promise.all([
            loader.load('1'),
            loader.load('2'),
            loader.load('3'),
        ]);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0]).toEqual(['1', '2', '3']);
        expect(a).toEqual({id: '1', name: 'n-1'});
        expect(b).toEqual({id: '2', name: 'n-2'});
        expect(c).toEqual({id: '3', name: 'n-3'});
    });

    it('dedupes identical keys within a tick', async () => {
        const fn = vi.fn(async (ids: readonly string[]) =>
            ids.map(id => ({id})));
        const loader = new BatchLoader(fn);
        const [a, b, c] = await Promise.all([
            loader.load('x'),
            loader.load('x'),
            loader.load('y'),
        ]);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0]).toEqual(['x', 'y']);
        expect(a).toEqual({id: 'x'});
        expect(b).toEqual({id: 'x'});
        expect(c).toEqual({id: 'y'});
    });

    it('returns null for missing values', async () => {
        const fn = vi.fn(async (_ids: readonly string[]) => [null]);
        const loader = new BatchLoader<string, {id: string}>(fn);
        const v = await loader.load('missing');
        expect(v).toBeNull();
    });

    it('rejects all pending loads if the batch fn throws', async () => {
        const loader = new BatchLoader<string, unknown>(async () => {
            throw new Error('boom');
        });
        await expect(Promise.all([loader.load('a'), loader.load('b')]))
            .rejects.toThrow('boom');
    });

    it('starts a new batch on the next tick', async () => {
        const fn = vi.fn(async (ids: readonly string[]) => ids.map(id => id));
        const loader = new BatchLoader<string, string>(fn);
        await loader.load('1');
        await loader.load('2');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
