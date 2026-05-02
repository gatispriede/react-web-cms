import {beforeEach, describe, expect, it} from 'vitest';
import {InMemoryRedis} from '@services/infra/redis';
import {
    _resetCacheVersionsForTests,
    bumpFeatureVersion,
    bumpFeatureVersions,
    getFeatureVersion,
    getFeatureVersions,
    setCacheVersionBackend,
} from '@services/infra/cacheVersion';

describe('cacheVersion', () => {
    beforeEach(() => {
        _resetCacheVersionsForTests();
    });

    it('starts at 0 for unknown features', async () => {
        expect(await getFeatureVersion('posts')).toBe(0);
    });

    it('round-trips set/get via bump', async () => {
        expect(await bumpFeatureVersion('posts')).toBe(1);
        expect(await bumpFeatureVersion('posts')).toBe(2);
        expect(await getFeatureVersion('posts')).toBe(2);
    });

    it('isolates versions per feature', async () => {
        await bumpFeatureVersion('posts');
        await bumpFeatureVersion('posts');
        await bumpFeatureVersion('navigation');
        expect(await getFeatureVersion('posts')).toBe(2);
        expect(await getFeatureVersion('navigation')).toBe(1);
        expect(await getFeatureVersion('themes')).toBe(0);
    });

    it('bumps a batch in one call', async () => {
        const result = await bumpFeatureVersions(['posts', 'themes']);
        expect(result).toEqual({posts: 1, themes: 1});
        const snap = await getFeatureVersions(['posts', 'themes', 'unknown']);
        expect(snap).toEqual({posts: 1, themes: 1, unknown: 0});
    });

    it('uses an injected RedisLike', async () => {
        const mem = new InMemoryRedis();
        setCacheVersionBackend(mem);
        await bumpFeatureVersion('posts');
        expect(await mem.get('cms:cv:posts')).toBe('1');
    });
});
