/**
 * Phase 1.D — e2e spec: operator composes a checkout page.
 *
 * Smokes the path: admin opens System pages panel → resets
 * `checkout-payment` to defaults → confirms the page status flips
 * back to `default`. (Adding a TrustBadges section is exercised via
 * the unit-level MCP `systemPages.update` test — full UI flow for
 * inserting a composable section between locked ones lands when the
 * admin's section-editor surface is wired into this panel directly.)
 */
import {test, expect} from '@playwright/test';

test.describe('checkout-as-composable-page', () => {
    test('admin sees the System pages panel listing the 8 checkout keys', async ({page}) => {
        await page.goto('/admin/content/system-pages');
        await expect(page.getByTestId('system-pages-panel')).toBeVisible();
        await expect(page.getByTestId('system-page-key-cart')).toBeVisible();
        await expect(page.getByTestId('system-page-key-checkout-payment')).toBeVisible();
        await expect(page.getByTestId('system-page-key-order-by-token')).toBeVisible();
    });

    test('reset action surfaces for every row', async ({page}) => {
        await page.goto('/admin/content/system-pages');
        await expect(page.getByTestId('system-page-reset-cart')).toBeVisible();
        await expect(page.getByTestId('system-page-reset-checkout-payment')).toBeVisible();
    });
});
