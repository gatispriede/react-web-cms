import {describe, it, expect} from 'vitest';
import {isInArea, resolveActiveArea, PARENT_BUCKET_OVERRIDES} from './adminAreaItems';

describe('isInArea', () => {
    it('matches the exact area slug', () => {
        expect(isInArea('content', 'content')).toBe(true);
        expect(isInArea('settings', 'content')).toBe(false);
    });

    it('matches a path under the area slug', () => {
        expect(isInArea('release/bundle', 'release')).toBe(true);
        expect(isInArea('content/products', 'content')).toBe(true);
    });

    it('does not match a slug-prefix that is not a full segment', () => {
        // `system-pages` is NOT under `system`
        expect(isInArea('content/system-pages', 'system')).toBe(false);
    });
});

describe('resolveActiveArea', () => {
    const allBuckets = [
        'build', 'content', 'settings', 'analytics', 'system',
        'site', 'commerce', 'people',
        'client-config', 'seo', 'release',
    ];

    it('keeps Publishing pinned to the Content bucket', () => {
        // Regression: opening `/admin/release/publishing` from the Content
        // rail should NOT swap to the legacy `release` rail.
        expect(resolveActiveArea('release/publishing', allBuckets)).toBe('content');
    });

    it('keeps Theme pinned to the Settings bucket', () => {
        expect(resolveActiveArea('client-config/themes', allBuckets)).toBe('settings');
    });

    it('keeps Audit log pinned to the Analytics bucket', () => {
        expect(resolveActiveArea('release/audit', allBuckets)).toBe('analytics');
    });

    it('keeps Bundle pinned to the System bucket', () => {
        expect(resolveActiveArea('release/bundle', allBuckets)).toBe('system');
    });

    it('keeps SEO defaults pinned to the Settings bucket', () => {
        expect(resolveActiveArea('seo', allBuckets)).toBe('settings');
    });

    it('falls back to prefix matching for views without an override', () => {
        expect(resolveActiveArea('content/products', allBuckets)).toBe('content');
        expect(resolveActiveArea('settings/chrome/footer', allBuckets)).toBe('settings');
        expect(resolveActiveArea('build', allBuckets)).toBe('build');
    });

    it('prefers new buckets over legacy aliases on prefix collision', () => {
        // `system/diagnostics` is in the System bucket; the override map
        // has no entry, prefix-matching still picks `system` (new bucket).
        expect(resolveActiveArea('system/diagnostics', allBuckets)).toBe('system');
    });

    it('returns null when no bucket matches', () => {
        expect(resolveActiveArea('nonexistent/path', allBuckets)).toBeNull();
    });

    it('falls back gracefully when the override target is not in the bucket list', () => {
        // If the simplified-mode rail set excludes a bucket, the override
        // map must not force a missing bucket — fall back to prefix matching.
        const noContent = allBuckets.filter(b => b !== 'content');
        // Override says `release/publishing` → `content`, but `content` is
        // not in the bucket list — fall back to the legacy `release`.
        expect(resolveActiveArea('release/publishing', noContent)).toBe('release');
    });
});

describe('PARENT_BUCKET_OVERRIDES', () => {
    it('does not point any view at a bucket that is not a new bucket', () => {
        const validTargets = new Set(['build', 'content', 'settings', 'analytics', 'system']);
        for (const [view, target] of Object.entries(PARENT_BUCKET_OVERRIDES)) {
            expect(validTargets.has(target), `${view} → ${target} is not a new bucket`).toBe(true);
        }
    });
});
