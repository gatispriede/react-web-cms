import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Inventory (admin)
//
// Admin opens /admin/content/inventory. Inventory ties into product
// stock + warehouse adapters; with `ProductApi` mocked the page
// should still render an empty/configuration state without crashing.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — inventory admin', () => {
    test('admin can open the inventory page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/inventory');
        await expect(adminPage.locator('body')).toBeVisible({timeout: 15_000});
    });
});
