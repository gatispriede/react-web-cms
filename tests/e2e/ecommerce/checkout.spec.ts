import {test, expect} from '../fixtures/auth';
import {createCleanupRegistry, seedProduct} from '../fixtures/seedFactories';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Checkout
//
// FLOW
//   1. Empty cart on /checkout → renders without crashing.
//   2. Cart with a seeded product → address → shipping → payment →
//      confirmation. Confirmation shows the order id.
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — checkout happy-path', () => {
    const cleanups = createCleanupRegistry();
    test.afterEach(() => cleanups.flush());

    test('empty cart on /checkout does not crash', async ({anonPage}) => {
        await anonPage.goto('/checkout');
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
    });

    test('customer can complete checkout end-to-end', async ({mongo, anonPage}) => {
        const p = await seedProduct(mongo.uri);
        cleanups.register(p.cleanup);

        await anonPage.goto(`/products/${p.slug}`);
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();

        await anonPage.goto('/cart');
        await anonPage.getByTestId('cart-checkout-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/address/, {timeout: 15_000});
        await anonPage.getByTestId('checkout-address-name-input').fill('Jane Tester');
        await anonPage.getByTestId('checkout-address-line1-input').fill('1 Test Street');
        await anonPage.getByTestId('checkout-address-city-input').fill('Riga');
        await anonPage.getByTestId('checkout-address-postal-input').fill('LV-1010');
        // The country field is a 2-letter code Input (testid name ends in -select for legacy reasons).
        await anonPage.getByTestId('checkout-address-country-select').fill('LV');
        await anonPage.getByTestId('checkout-address-continue-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/shipping/, {timeout: 15_000});
        await anonPage.getByTestId('checkout-shipping-continue-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/payment/, {timeout: 15_000});
        await anonPage.getByTestId('checkout-payment-place-order-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/confirmation\/.+/, {timeout: 30_000});
        const orderId = anonPage.getByTestId('order-confirmation-id');
        await expect(orderId).toBeVisible();
        await expect(orderId).not.toBeEmpty();
    });
});
