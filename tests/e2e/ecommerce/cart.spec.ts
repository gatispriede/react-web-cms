import {test, expect} from '../fixtures/auth';
import {createCleanupRegistry, seedProduct} from '../fixtures/seedFactories';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Cart
//
// FLOW
//   1. Empty /cart renders.
//   2. Seed product → /products/[slug] → Add to cart → /cart shows the line.
//   3. Quantity update flow — `cart-item-qty-input-${sku}`. Skipped where
//      the qty stepper testid isn't wired (current cart UI uses a single
//      "remove" without a +/- stepper); see gap matrix.
//
// Cart state is per-context (localStorage), so each test owns its cart.
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — cart happy-path', () => {
    const cleanups = createCleanupRegistry();
    test.afterEach(() => cleanups.flush());

    test('anon customer sees an empty-cart state on /cart', async ({anonPage}) => {
        await anonPage.goto('/cart');
        await expect(anonPage.getByTestId('cart-empty-state')).toBeVisible({timeout: 15_000});
    });

    test('anon customer adds a product to cart', async ({mongo, anonPage}) => {
        const p = await seedProduct(mongo.uri);
        cleanups.register(p.cleanup);

        await anonPage.goto(`/products/${p.slug}`);
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();
        await anonPage.goto('/cart');
        await expect(anonPage.getByTestId(`cart-item-row-${p.sku}`)).toBeVisible({timeout: 15_000});
    });

    test.skip('anon customer updates item quantity', async ({mongo, anonPage}) => {
        // GAP: current /cart UI has no `cart-item-qty-input-${sku}` stepper.
        // See docs/runbooks/e2e-coverage-matrix.md (Cart row).
        const p = await seedProduct(mongo.uri);
        cleanups.register(p.cleanup);
        await anonPage.goto(`/products/${p.slug}`);
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();
        await anonPage.goto('/cart');
        const qty = anonPage.getByTestId(`cart-item-qty-input-${p.sku}`);
        await qty.fill('2');
        await qty.blur();
        await expect(qty).toHaveValue('2');
    });

    test.skip('anon customer removes item from cart', async ({mongo, anonPage}) => {
        // GAP: current /cart UI has no per-row `cart-item-remove-btn-${sku}`.
        const p = await seedProduct(mongo.uri);
        cleanups.register(p.cleanup);
        await anonPage.goto(`/products/${p.slug}`);
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();
        await anonPage.goto('/cart');
        await anonPage.getByTestId(`cart-item-remove-btn-${p.sku}`).click();
        await expect(anonPage.getByTestId('cart-empty-state')).toBeVisible();
    });
});
