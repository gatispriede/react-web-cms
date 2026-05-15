import {test, expect} from '../fixtures/auth';

/**
 * Phase 1.B sub-jump B — `commerce.checkoutEnabled === true`.
 *
 * Smoke test for the enabled state. Flipping the flag in CI requires a
 * fixture step that's not yet shipped (`auth-split` Phase 1.A faces the
 * same gap and adds it in sub-jump C). For now this spec is a
 * placeholder that asserts the API endpoint behaves correctly when the
 * flag is on — the full middleware-on-then-checkout-renders flow lands
 * with the C fixture helpers.
 *
 * When you wire the flag-set fixture, replace the API smoke with:
 *   await setCommerceFlag(admin, 'checkoutEnabled', true);
 *   await anonPage.goto('/checkout');
 *   await expect(anonPage.getByTestId('cart-drawer-toggle')).toBeVisible();
 */
test.describe('storefront — checkout enabled', () => {
    test('flag-status endpoint responds with a boolean', async ({anonPage}) => {
        const response = await anonPage.request.get('/api/commerce/flag-status');
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body).toHaveProperty('checkoutEnabled');
        expect(typeof body.checkoutEnabled).toBe('boolean');
    });
});
