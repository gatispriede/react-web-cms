import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Products
//
// FLOW
//   1. Admin opens /admin/content/products and the create button is
//      visible (regression guard for the admin shell mount).
//   2. Admin creates a product (name, price, image, stock) — currently
//      SKIPPED, see TODO selectors below.
//   3. Anonymous customer browses /products and sees the storefront card.
//   4. Anonymous customer opens /products/[slug] — detail page renders.
//
// DATA STATE
//   No prior data assumed. The "admin sees create button" + "public list
//   renders" assertions work against an empty `ProductApi` mock (current
//   stub state) and against a real, empty Mongo. The slug-detail path
//   hits a known fixture slug once seedFactories.seedProduct exists.
//
// SELECTOR GAPS (TODO — wire data-testids in the product UI components):
//   - data-testid="admin-products-create-btn"          → admin "New product" button
//   - data-testid="admin-products-name-input"          → name field in editor
//   - data-testid="admin-products-price-input"         → price field in editor
//   - data-testid="admin-products-stock-input"         → stock field in editor
//   - data-testid="admin-products-image-input"         → image URL field in editor
//   - data-testid="admin-products-save-btn"            → submit on the editor
//   - data-testid="admin-products-row-${slug}"         → table row by slug
//   - data-testid="storefront-product-card-${slug}"    → public listing card
//   - data-testid="storefront-product-title"           → on /products/[slug]
//   - data-testid="storefront-product-price"           → on /products/[slug]
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — products happy-path', () => {
    test('admin can open the products page and see create CTA', async ({adminPage}) => {
        await adminPage.goto('/admin/content/products');
        await expect(
            adminPage.getByRole('button', {name: /new product|add product|create/i}).first(),
        ).toBeVisible({timeout: 15_000});
    });

    test('admin can create a product end-to-end', async ({adminPage}) => {
        // Editor lives behind a Drawer launched from the create button on the
        // index page (no /products/new route). Open the index, click the
        // create CTA, then drive the form via the testids wired on the inputs.
        await adminPage.goto('/admin/content/products');
        await adminPage.getByTestId('admin-products-create-btn').click();
        await adminPage.getByTestId('admin-products-name-input').fill('E2E Product');
        await adminPage.getByTestId('admin-products-price-input').fill('1999');
        await adminPage.getByTestId('admin-products-stock-input').fill('10');
        await adminPage.getByTestId('admin-products-image-input').fill('https://example.com/p.png');
        await adminPage.getByTestId('admin-products-save-btn').click();
        await expect(adminPage.getByTestId('admin-products-row-e2e-product')).toBeVisible();
    });

    test('public products index renders without crashing', async ({anonPage}) => {
        await anonPage.goto('/products');
        // Page mounts and at least the document <body> is present. With a
        // populated catalog `storefront-product-card-*` should be visible —
        // see skip below.
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(anonPage).toHaveURL(/\/products\/?$/);
    });

    test.skip('storefront product card links to detail page', async ({anonPage}) => {
        // TODO: unskip once `storefront-product-card-${slug}` exists and a
        // seeded product is inserted via seedFactories. The exact slug here
        // is whatever the seed step picks.
        await anonPage.goto('/products');
        const card = anonPage.getByTestId('storefront-product-card-e2e-product');
        await expect(card).toBeVisible();
        await card.click();
        await expect(anonPage).toHaveURL(/\/products\/e2e-product$/);
        await expect(anonPage.getByTestId('storefront-product-title')).toHaveText(/E2E Product/i);
    });
});
