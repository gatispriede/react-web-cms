import {test, expect} from '../fixtures/auth';

/**
 * auth-split-client-admin Phase 1.A — flag-off acceptance.
 *
 * Default `siteFlags.auth.clientLoginEnabled === false` (per
 * `services/features/Auth/authFlags.ts`). The acceptance criteria are:
 *
 *   1. `/account/signin` returns 404 (middleware rewrite).
 *   2. The storefront header shows no `customer-account-dropdown` /
 *      `customer-account-signin-link` element.
 *   3. The storefront footer shows no `footer-account-links` block.
 *   4. The signup banner does not render anywhere on the site.
 */

test.describe('feature — customer-login disabled (default)', () => {
    test('/account/signin rewrites to 404 via middleware', async ({anonPage}) => {
        const res = await anonPage.goto('/account/signin');
        // Middleware rewrites to /404 — Next's standard 404 page returns 200
        // status on the rewrite target by design (NextResponse.rewrite),
        // so we assert on the rendered content rather than the status.
        await expect(anonPage.locator('body')).toContainText(/404|not\s*found/i, {timeout: 10_000});
        // Sanity — the signin form should not be present
        await expect(anonPage.getByTestId('customer-signin-magic-section')).toHaveCount(0);
    });

    test('homepage shows no account dropdown or footer account links', async ({anonPage}) => {
        await anonPage.goto('/');
        await expect(anonPage.getByTestId('customer-account-dropdown')).toHaveCount(0);
        await expect(anonPage.getByTestId('customer-account-signin-link')).toHaveCount(0);
        await expect(anonPage.getByTestId('footer-account-links')).toHaveCount(0);
        await expect(anonPage.getByTestId('signup-banner')).toHaveCount(0);
    });
});
