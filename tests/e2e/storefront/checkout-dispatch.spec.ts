/**
 * Phase 1.D-c — e2e spec: checkout routes render via SectionContent
 * dispatch (`<SystemPageDispatch>`).
 *
 * Asserts every refactored route mounts the dispatch shim — the
 * `data-testid="system-page-dispatch"` + `data-system-key="…"` marker
 * is the contract between the route's thin loader and the
 * `<SystemPageDispatch>` component. If a route reverts to hand-coded
 * UI the marker disappears and this spec fails.
 */
import {test, expect} from '@playwright/test';

const ROUTES: Array<{path: string; key: string}> = [
    {path: '/cart', key: 'cart'},
    {path: '/checkout/address', key: 'checkout-address'},
    {path: '/checkout/shipping', key: 'checkout-shipping'},
    {path: '/checkout/payment', key: 'checkout-payment'},
    {path: '/checkout/confirmation/test-order', key: 'checkout-confirmation'},
];

test.describe('checkout dispatch', () => {
    for (const {path, key} of ROUTES) {
        test(`${path} renders via SystemPageDispatch (key=${key})`, async ({page}) => {
            await page.goto(path);
            const host = page.getByTestId('system-page-dispatch');
            await expect(host).toBeVisible();
            await expect(host).toHaveAttribute('data-system-key', key);
        });
    }
});
