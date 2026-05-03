import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Cart
//
// FLOW
//   1. Anonymous customer opens /cart on a fresh context — empty state
//      mounts (regression guard).
//   2. Customer goes to /products/[slug], clicks "Add to cart", lands
//      back on /cart with item + quantity 1 (SKIPPED — needs testids).
//   3. Customer increments quantity to 2 (SKIPPED — needs testids).
//   4. Customer removes the item; cart returns to empty (SKIPPED).
//
// DATA STATE
//   Independent: each test starts in a fresh `anonPage` browser context,
//   so cart state (localStorage / cookie-driven) is empty. The add-to-cart
//   flow assumes a seeded product slug "e2e-product" — the seed call lives
//   in `test.beforeEach` and will be unskipped once `seedProduct` exists
//   in seedFactories.
//
// SELECTOR GAPS (TODO — wire data-testids):
//   - data-testid="storefront-add-to-cart-btn"        → on /products/[slug]
//   - data-testid="cart-item-row-${slug}"             → cart line row
//   - data-testid="cart-item-qty-input-${slug}"       → quantity stepper input
//   - data-testid="cart-item-remove-btn-${slug}"      → remove button
//   - data-testid="cart-empty-state"                  → shown when cart is []
//   - data-testid="cart-line-count"                   → header count badge
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — cart happy-path', () => {
    test('anon customer sees an empty-cart state on /cart', async ({anonPage}) => {
        await anonPage.goto('/cart');
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(anonPage).toHaveURL(/\/cart\/?$/);
    });

    test.skip('anon customer adds a product to cart', async ({anonPage}) => {
        // TODO: unskip once seedProduct + storefront-add-to-cart-btn exist.
        await anonPage.goto('/products/e2e-product');
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();
        await anonPage.goto('/cart');
        await expect(anonPage.getByTestId('cart-item-row-e2e-product')).toBeVisible();
        await expect(anonPage.getByTestId('cart-item-qty-input-e2e-product')).toHaveValue('1');
    });

    test.skip('anon customer updates item quantity', async ({anonPage}) => {
        // TODO: unskip when stepper testid is added.
        await anonPage.goto('/products/e2e-product');
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();
        await anonPage.goto('/cart');
        const qty = anonPage.getByTestId('cart-item-qty-input-e2e-product');
        await qty.fill('2');
        await qty.blur();
        await expect(qty).toHaveValue('2');
    });

    test.skip('anon customer removes item from cart', async ({anonPage}) => {
        // TODO: unskip when remove testid is added.
        await anonPage.goto('/products/e2e-product');
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();
        await anonPage.goto('/cart');
        await anonPage.getByTestId('cart-item-remove-btn-e2e-product').click();
        await expect(anonPage.getByTestId('cart-empty-state')).toBeVisible();
    });
});
