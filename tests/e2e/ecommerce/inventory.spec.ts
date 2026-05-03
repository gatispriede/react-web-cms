import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Inventory
//
// FLOW
//   1. Admin opens /admin/content/inventory — page mounts (regression
//      guard for the admin shell + tab).
//   2. Admin sets stock for a seeded product to 0; storefront product
//      detail flips to an out-of-stock state and the add-to-cart button
//      is disabled (SKIPPED — needs testids).
//
// DATA STATE
//   The stock-adjust test depends on a seeded product (slug
//   "e2e-product") inserted via seedFactories.seedProduct (TODO). Each
//   test starts with its own admin/anon contexts, so storefront state is
//   not affected by other specs.
//
// SELECTOR GAPS (TODO — wire data-testids):
//   - data-testid="admin-inventory-row-${slug}"         → table row
//   - data-testid="admin-inventory-stock-input-${slug}" → editable cell
//   - data-testid="admin-inventory-save-btn-${slug}"    → save row
//   - data-testid="storefront-out-of-stock-badge"       → product detail
//   - data-testid="storefront-add-to-cart-btn"          → product detail
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — inventory happy-path', () => {
    test('admin can open the inventory page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/inventory');
        await expect(adminPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(adminPage).toHaveURL(/\/admin\/content\/inventory\/?$/);
    });

    test.skip('admin sets stock to 0 and storefront reflects out-of-stock', async ({adminPage, anonPage}) => {
        // TODO: unskip once seedProduct + inventory testids are wired.
        await adminPage.goto('/admin/content/inventory');
        const stock = adminPage.getByTestId('admin-inventory-stock-input-e2e-product');
        await stock.fill('0');
        await adminPage.getByTestId('admin-inventory-save-btn-e2e-product').click();

        await anonPage.goto('/products/e2e-product');
        await expect(anonPage.getByTestId('storefront-out-of-stock-badge')).toBeVisible();
        await expect(anonPage.getByTestId('storefront-add-to-cart-btn')).toBeDisabled();
    });
});
