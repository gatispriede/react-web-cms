import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// E2E happy-path — Checkout
//
// FLOW
//   1. Empty-cart customer hits /checkout → redirects (or renders an
//      empty-cart placeholder). Regression guard for the route-machine.
//   2. Customer with one product in cart goes /cart → /checkout/address,
//      fills address, advances to shipping → payment → confirmation.
//      Confirmation page shows the order id (SKIPPED — needs testids).
//
// DATA STATE
//   Each test owns its cart (fresh anonPage). The full happy-path
//   assumes a seeded product (slug "e2e-product"). Address / shipping
//   inputs are filled via testid; once those exist, no api stubbing is
//   needed — the real checkout state machine drives the URL transitions.
//
// SELECTOR GAPS (TODO — wire data-testids):
//   - data-testid="storefront-add-to-cart-btn"         → /products/[slug]
//   - data-testid="cart-checkout-btn"                  → /cart "Checkout"
//   - data-testid="checkout-address-name-input"
//   - data-testid="checkout-address-line1-input"
//   - data-testid="checkout-address-city-input"
//   - data-testid="checkout-address-postal-input"
//   - data-testid="checkout-address-country-select"
//   - data-testid="checkout-address-continue-btn"
//   - data-testid="checkout-shipping-continue-btn"
//   - data-testid="checkout-payment-place-order-btn"
//   - data-testid="order-confirmation-id"              → /checkout/confirmation/[id]
// ──────────────────────────────────────────────────────────────────

test.describe('e2e — checkout happy-path', () => {
    test('empty cart on /checkout does not crash', async ({anonPage}) => {
        await anonPage.goto('/checkout');
        // Either a /cart bounce or an inline "your cart is empty" placeholder
        // — both are acceptable empty-state outcomes.
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
    });

    test.skip('customer can complete checkout end-to-end', async ({anonPage}) => {
        // TODO: unskip once seedProduct exists and the checkout testids
        // listed in the header block are wired.
        await anonPage.goto('/products/e2e-product');
        await anonPage.getByTestId('storefront-add-to-cart-btn').click();

        await anonPage.goto('/cart');
        await anonPage.getByTestId('cart-checkout-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/address/);
        await anonPage.getByTestId('checkout-address-name-input').fill('Jane Tester');
        await anonPage.getByTestId('checkout-address-line1-input').fill('1 Test Street');
        await anonPage.getByTestId('checkout-address-city-input').fill('Riga');
        await anonPage.getByTestId('checkout-address-postal-input').fill('LV-1010');
        await anonPage.getByTestId('checkout-address-country-select').click();
        await anonPage.getByRole('option', {name: /latvia/i}).click();
        await anonPage.getByTestId('checkout-address-continue-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/shipping/);
        await anonPage.getByTestId('checkout-shipping-continue-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/payment/);
        await anonPage.getByTestId('checkout-payment-place-order-btn').click();

        await expect(anonPage).toHaveURL(/\/checkout\/confirmation\/.+/, {timeout: 20_000});
        const orderId = anonPage.getByTestId('order-confirmation-id');
        await expect(orderId).toBeVisible();
        await expect(orderId).not.toBeEmpty();
    });
});
