import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Orders (admin)
//
// FLOW
//   1. Admin opens /admin/content/orders — page mounts (regression guard).
//   2. After a fixture-seeded order exists, admin clicks into its detail
//      page and sees correct line items + total (SKIPPED — needs testids
//      and seedOrder fixture).
//
// DATA STATE
//   This spec must NOT depend on `checkout.spec.ts` having run — order
//   data is seeded directly via seedFactories.seedOrder (TODO). The seed
//   inserts a single order with one line of "e2e-product" × 1 at €19.99
//   so total = 1999 cents.
//
// SELECTOR GAPS (TODO — wire data-testids):
//   - data-testid="admin-orders-row-${id}"             → table row
//   - data-testid="admin-orders-row-link-${id}"        → opens detail
//   - data-testid="admin-order-detail-line-${slug}"    → line row in detail
//   - data-testid="admin-order-detail-line-qty-${slug}"
//   - data-testid="admin-order-detail-line-price-${slug}"
//   - data-testid="admin-order-detail-total"           → total summary
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — orders happy-path', () => {
    test('admin can open the orders page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/orders');
        await expect(adminPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(adminPage).toHaveURL(/\/admin\/content\/orders\/?$/);
    });

    test.skip('admin opens an order and sees correct line items + total', async ({adminPage}) => {
        // TODO: unskip once seedOrder fixture exists and the order/detail
        // testids in the header block are wired. The fixture should expose
        // the inserted order id so this test stays self-contained.
        const seededOrderId = 'TODO-order-id';
        await adminPage.goto('/admin/content/orders');
        await adminPage.getByTestId(`admin-orders-row-link-${seededOrderId}`).click();

        await expect(adminPage).toHaveURL(new RegExp(`/admin/content/orders/${seededOrderId}$`));
        await expect(adminPage.getByTestId('admin-order-detail-line-e2e-product')).toBeVisible();
        await expect(adminPage.getByTestId('admin-order-detail-line-qty-e2e-product')).toHaveText('1');
        await expect(adminPage.getByTestId('admin-order-detail-total')).toContainText(/19[.,]99/);
    });
});
