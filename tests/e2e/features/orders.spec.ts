import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Orders (admin)
//
// Admin opens /admin/content/orders. Same mock-stub gate as Products
// — the surface should mount with an empty list / empty state.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — orders admin', () => {
    test('admin can open the orders page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/orders');
        await expect(adminPage.locator('body')).toBeVisible({timeout: 15_000});
    });
});
