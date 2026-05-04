import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Bundle export / import
//
// Admin opens /admin/release/bundle. Smoke step 2 covers the actual
// import round-trip with the canonical CV bundle; this spec is the
// non-smoke surface-mount regression guard.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — bundle import/export', () => {
    test('admin can open the bundle page', async ({adminPage}) => {
        await adminPage.goto('/admin/release/bundle');
        // Either the import file input or the export button proves the
        // surface mounts. Both have testids — `bundle-import-file-input`
        // (smoke) and `bundle-export-btn` (separate).
        await expect(
            adminPage.locator('input[type="file"], button').first(),
        ).toBeVisible({timeout: 15_000});
    });
});
