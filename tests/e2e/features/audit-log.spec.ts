import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Audit log
//
// Admin opens /admin/release/audit. The audit page is read-only and
// should always mount cleanly even on an empty database. We assert
// the surface renders without 5xxs; per-action coverage is implicit
// in the publishing.spec.ts (writes a publish row) and the bundle
// import flow (writes an import row) specs.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — audit log', () => {
    test('admin can open the audit page', async ({adminPage}) => {
        await adminPage.goto('/admin/release/audit');
        await expect(
            adminPage.locator('.ant-table, .ant-empty').first(),
        ).toBeVisible({timeout: 15_000});
    });
});
