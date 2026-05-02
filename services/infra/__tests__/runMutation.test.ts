import {beforeEach, describe, expect, it} from 'vitest';
import {runMutation} from '@services/infra/featureRegistry';
import {_resetCacheVersionsForTests, getFeatureVersion} from '@services/infra/cacheVersion';

describe('runMutation', () => {
    beforeEach(() => {
        _resetCacheVersionsForTests();
    });

    it('bumps cacheVersionKeys for the active feature on success', async () => {
        // Posts is core-infrastructure and declares cacheVersionKeys=['posts'].
        const before = await getFeatureVersion('posts');
        const result = await runMutation('posts', async () => 'ok');
        expect(result).toBe('ok');
        const after = await getFeatureVersion('posts');
        expect(after).toBe(before + 1);
    });

    it('does not bump on failure', async () => {
        const before = await getFeatureVersion('posts');
        await expect(runMutation('posts', async () => { throw new Error('x'); }))
            .rejects.toThrow('x');
        expect(await getFeatureVersion('posts')).toBe(before);
    });

    it('is a no-op for features without cacheVersionKeys', async () => {
        const ret = await runMutation('feature-without-keys-xyz', async () => 42);
        expect(ret).toBe(42);
    });
});
