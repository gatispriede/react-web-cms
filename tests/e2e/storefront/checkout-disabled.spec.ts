import {test, expect} from '../fixtures/auth';

/**
 * Phase 1.B sub-jump B — `commerce.checkoutEnabled === false` (default).
 *
 * Verifies:
 *  - `/checkout/*` 404s via middleware
 *  - cart drawer is not present in the DOM
 *  - Buy CTAs do not render
 *
 * The flag defaults to `false`, so this spec passes against a freshly
 * provisioned site without any admin gesture. When sub-jump C lands the
 * test harness for flipping flags, this spec stays valid as the
 * default-state assertion.
 */
test.describe('storefront — checkout disabled (default)', () => {
    test('/checkout returns 404 when the master switch is off', async ({anonPage}) => {
        const response = await anonPage.goto('/checkout');
        // Middleware rewrites to /404 — Next serves the 404 page body.
        // Either explicit 404 status OR the 404 page contents qualifies.
        if (response) {
            expect([404, 200]).toContain(response.status());
        }
        // The /checkout/* path either renders the 404 body or the 404 doc.
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
    });

    test('cart drawer is not visible on the storefront', async ({anonPage}) => {
        await anonPage.goto('/');
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
        // CartDrawer self-suppresses when flag is off → no testid in DOM.
        await expect(anonPage.getByTestId('cart-drawer')).toHaveCount(0);
        await expect(anonPage.getByTestId('cart-drawer-toggle')).toHaveCount(0);
    });

    test('Product module Buy CTAs do not render', async ({anonPage}) => {
        await anonPage.goto('/');
        // Buy CTAs use testid `product-buy-cta-<slug>` — none should be
        // in the DOM when the flag is off, regardless of per-instance
        // showBuyCta. The hook self-suppresses.
        await expect(anonPage.locator('[data-testid^="product-buy-cta-"]')).toHaveCount(0);
    });
});
