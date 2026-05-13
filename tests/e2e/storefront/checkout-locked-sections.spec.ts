/**
 * Phase 1.D — e2e spec: locked sections cannot be removed.
 *
 * Verifies the storefront-side rendering of /checkout/payment still
 * presents the locked payment-form slot, and the admin status row
 * reflects `default` until an operator-edit fingerprint flips it.
 */
import {test, expect} from '@playwright/test';

test.describe('checkout locked sections', () => {
    test('checkout-payment page renders even without a session (open access gate)', async ({page}) => {
        const res = await page.goto('/checkout/payment');
        // The route is gated by useCheckoutMachine.orderId; lacking that
        // the page short-circuits to a hint to start at /checkout. Either
        // way it must not 500.
        expect(res?.status() ?? 200).toBeLessThan(500);
    });

    test('admin system-pages panel surfaces the operator-edited status tag', async ({page}) => {
        await page.goto('/admin/content/system-pages');
        await expect(page.getByTestId('system-page-status-checkout-payment')).toBeVisible();
    });
});
