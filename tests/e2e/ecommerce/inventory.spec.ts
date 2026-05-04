import {test, expect} from '../fixtures/auth';
import {createCleanupRegistry, seedProduct} from '../fixtures/seedFactories';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Inventory
//
// FLOW
//   1. Admin opens /admin/content/inventory — page mounts.
//   2. Seeded product with stock=0 → storefront detail flips to
//      out-of-stock + add-to-cart disabled. The admin Inventory pane is
//      currently sync-only (no per-row stock edit), so we assert from
//      the storefront side using the seed factory directly.
//
// GAP: per-row stock edit in the admin Inventory pane (see matrix).
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — inventory happy-path', () => {
    const cleanups = createCleanupRegistry();
    test.afterEach(() => cleanups.flush());

    test('admin can open the inventory page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/inventory');
        await expect(adminPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(adminPage).toHaveURL(/\/admin\/content\/inventory\/?$/);
    });

    test('storefront reflects out-of-stock when stock=0', async ({mongo, anonPage}) => {
        const p = await seedProduct(mongo.uri, {stock: 0});
        cleanups.register(p.cleanup);

        await anonPage.goto(`/products/${p.slug}`);
        await expect(anonPage.getByTestId('storefront-out-of-stock-badge')).toBeVisible({timeout: 15_000});
        await expect(anonPage.getByTestId('storefront-add-to-cart-btn')).toBeDisabled();
    });
});
