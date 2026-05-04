import {test, expect} from '../fixtures/auth';
import {createCleanupRegistry, seedProduct} from '../fixtures/seedFactories';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Products
//
// FLOW
//   1. Admin opens /admin/content/products and the create CTA renders.
//   2. Admin creates a product end-to-end through the Drawer; row appears.
//   3. Public /products renders without crash.
//   4. Seeded product → storefront card → detail page roundtrip.
//
// DATA STATE
//   `seedProduct` inserts directly into Mongo (per-test cleanup via
//   `CleanupRegistry`). The admin-creates-product test still authors
//   through the UI.
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — products happy-path', () => {
    const cleanups = createCleanupRegistry();
    test.afterEach(() => cleanups.flush());

    test('admin can open the products page and see create CTA', async ({adminPage}) => {
        await adminPage.goto('/admin/content/products');
        await expect(adminPage.getByTestId('admin-products-create-btn')).toBeVisible({timeout: 15_000});
    });

    test('admin can create a product end-to-end', async ({adminPage}) => {
        const stamp = Date.now().toString(36);
        const slug = `e2e-product-${stamp}`;
        await adminPage.goto('/admin/content/products');
        await adminPage.getByTestId('admin-products-create-btn').click();
        await adminPage.getByTestId('admin-products-name-input').fill(slug);
        await adminPage.getByTestId('admin-products-price-input').fill('1999');
        await adminPage.getByTestId('admin-products-stock-input').fill('10');
        await adminPage.getByTestId('admin-products-image-input').fill('https://example.com/p.png');
        await adminPage.getByTestId('admin-products-save-btn').click();
        await expect(adminPage.getByTestId(`admin-products-row-${slug}`)).toBeVisible({timeout: 15_000});
    });

    test('public products index renders without crashing', async ({anonPage}) => {
        await anonPage.goto('/products');
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(anonPage).toHaveURL(/\/products\/?$/);
    });

    test('storefront product card links to detail page', async ({mongo, anonPage}) => {
        const p = await seedProduct(mongo.uri, {name: 'E2E Product Card'});
        cleanups.register(p.cleanup);

        await anonPage.goto('/products');
        const card = anonPage.getByTestId(`storefront-product-card-${p.slug}`);
        await expect(card).toBeVisible({timeout: 15_000});
        await card.click();
        await expect(anonPage).toHaveURL(new RegExp(`/products/${p.slug}$`));
        await expect(anonPage.getByTestId('storefront-product-title')).toBeVisible();
    });
});
