import {describe, it, expect, vi, beforeEach} from 'vitest';

// Mock the mongo connection so the helper can resolve a synthetic
// userService without booting Mongo.
const fakeUser: {adminUiMode?: 'simplified' | 'advanced'} = {};
vi.mock('@services/infra/mongoDBConnection', () => ({
    getMongoConnection: () => ({
        userService: {
            getUser: async ({email}: {email: string}) => {
                if (email === 'simplified@x') return {...fakeUser, adminUiMode: 'simplified'};
                if (email === 'advanced@x') return {...fakeUser, adminUiMode: 'advanced'};
                if (email === 'unknown@x') return undefined;
                return undefined;
            },
        },
    }),
}));

import {enforceModeForTool, FeatureRestrictedError} from '@services/features/Mcp/modeEnforcement';
import {ADVANCED_ONLY_TOOLS} from '@services/features/Mcp/ADVANCED_TOOLS';

describe('enforceModeForTool', () => {
    beforeEach(() => {
        // no per-test setup; mock is stateless
    });

    it('no-ops for tools that are not on the advanced-only list', async () => {
        await expect(enforceModeForTool('simplified@x', 'audit.list')).resolves.toBeUndefined();
        await expect(enforceModeForTool('simplified@x', 'page.list')).resolves.toBeUndefined();
    });

    it('throws FeatureRestrictedError when a simplified user invokes an advanced-only tool', async () => {
        await expect(enforceModeForTool('simplified@x', 'site.revalidate'))
            .rejects.toBeInstanceOf(FeatureRestrictedError);
    });

    it('allows advanced users through to advanced-only tools', async () => {
        await expect(enforceModeForTool('advanced@x', 'site.revalidate')).resolves.toBeUndefined();
    });

    it('default-allows when the actor is an mcp:<token> string (no user record)', async () => {
        await expect(enforceModeForTool('mcp:my-token', 'site.revalidate')).resolves.toBeUndefined();
    });

    it('default-allows when the actor email does not resolve to a user', async () => {
        await expect(enforceModeForTool('unknown@x', 'site.revalidate')).resolves.toBeUndefined();
    });

    it('default-allows on empty / falsy actor strings', async () => {
        await expect(enforceModeForTool('', 'site.revalidate')).resolves.toBeUndefined();
    });

    it('FeatureRestrictedError carries a stable code for downstream surfacing', async () => {
        try {
            await enforceModeForTool('simplified@x', 'auth.resetLockouts');
            throw new Error('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(FeatureRestrictedError);
            expect((err as FeatureRestrictedError).code).toBe('feature_restricted');
        }
    });

    it('keeps the allowlist non-empty (sanity guard against accidental wipe)', () => {
        expect(ADVANCED_ONLY_TOOLS.size).toBeGreaterThan(0);
    });
});
