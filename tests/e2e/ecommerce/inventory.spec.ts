import {test, expect} from '../fixtures/auth';
import {createCleanupRegistry, seedProduct} from '../fixtures/seedFactories';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Inventory
//
// FLOW
//   1. Seed a product with stock=10.
//   2. Admin opens /admin/content/inventory — pane mounts with the new
//      inline "Stock by product" table.
//   3. Admin sets the row's stock to 0 and clicks Save.
//   4. Storefront detail page for the same slug flips to out-of-stock +
//      add-to-cart disabled.
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

    test('admin edits stock to 0 inline → storefront flips out-of-stock', async ({mongo, adminPage, anonPage}) => {
        const p = await seedProduct(mongo.uri, {stock: 10});
        cleanups.register(p.cleanup);

        await adminPage.goto('/admin/content/inventory');
        const input = adminPage.getByTestId(`admin-inventory-stock-input-${p.slug}`);
        await expect(input).toBeVisible({timeout: 15_000});
        // AntD InputNumber: clear by triple-clicking the underlying input then typing.
        const inner = input.locator('input');
        await inner.click();
        await inner.press('ControlOrMeta+A');
        await inner.fill('0');
        await inner.press('Tab');
        await adminPage.getByTestId(`admin-inventory-save-btn-${p.slug}`).click();
        await expect(adminPage.getByTestId(`admin-inventory-just-saved-${p.slug}`)).toBeVisible({timeout: 15_000});

        await anonPage.goto(`/products/${p.slug}`);
        await expect(anonPage.getByTestId('storefront-out-of-stock-badge')).toBeVisible({timeout: 15_000});
        await expect(anonPage.getByTestId('storefront-add-to-cart-btn')).toBeDisabled();
    });
});
