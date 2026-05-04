import {test, expect} from '../fixtures/auth';
import {createCleanupRegistry, seedOrder} from '../fixtures/seedFactories';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Orders (admin)
//
// FLOW
//   1. Admin opens /admin/content/orders — index mounts.
//   2. Seeded order (one line, qty 1, €19.99) → admin clicks the row,
//      detail Drawer opens with the line + total. The current Orders UI
//      uses a Drawer, NOT URL navigation — so we assert the drawer
//      content rather than `/orders/[id]` URL.
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — orders happy-path', () => {
    const cleanups = createCleanupRegistry();
    test.afterEach(() => cleanups.flush());

    test('admin can open the orders page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/orders');
        await expect(adminPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(adminPage).toHaveURL(/\/admin\/content\/orders\/?$/);
    });

    test('admin opens a seeded order and sees correct line items + total', async ({mongo, adminPage}) => {
        const order = await seedOrder(mongo.uri, {
            customerEmail: 'orders-spec@e2e.local',
            lines: [{productSlug: 'orders-spec-prod', qty: 1, unitPrice: 1999, sku: 'ORDERS-SPEC-PROD'}],
        });
        cleanups.register(order.cleanup);

        await adminPage.goto('/admin/content/orders');
        const link = adminPage.getByTestId(`admin-orders-row-link-${order.id}`);
        await expect(link).toBeVisible({timeout: 15_000});
        await link.click();

        // Drawer (not URL nav). Detail testids live inside the drawer.
        await expect(adminPage.getByTestId('admin-order-detail-line-ORDERS-SPEC-PROD')).toBeVisible({timeout: 15_000});
        await expect(adminPage.getByTestId('admin-order-detail-line-qty-ORDERS-SPEC-PROD')).toHaveText('1');
        await expect(adminPage.getByTestId('admin-order-detail-total')).toContainText(/19[.,]99/);
    });
});
