import {test, expect} from '../fixtures/auth';

/**
 * auth-split-client-admin Phase 1.A — cross-kind isolation.
 *
 * The two NextAuth instances issue different session cookies
 * (`cms.admin-session` vs `cms.customer-session`). An anon browser
 * landing on `/admin` should redirect to `/admin/signin` (or render
 * the legacy admin shell with a sign-in panel) — never the customer
 * shell, never the admin shell pre-authed by a stray customer cookie.
 */

test.describe('feature — admin / customer cookie isolation', () => {
    test('anon browser on /admin/signin renders the admin sign-in page', async ({anonPage}) => {
        await anonPage.goto('/admin/signin');
        await expect(anonPage.getByTestId('admin-signin-email-input')).toBeVisible({timeout: 10_000});
        await expect(anonPage.getByTestId('admin-signin-submit-btn')).toBeVisible();
        // Customer surfaces must NOT appear on the admin sign-in page —
        // any leakage would mean we accidentally cross-rendered the
        // customer signin.
        await expect(anonPage.getByTestId('customer-signin-magic-section')).toHaveCount(0);
        await expect(anonPage.getByTestId('magic-link-form')).toHaveCount(0);
    });

    test('admin cookie cannot read customer surfaces', async ({adminPage, request, serverUrl}) => {
        // Enable customer login so /account/signin is reachable.
        await request.post(`${serverUrl}/api/mcp/tools/call`, {
            data: {name: 'auth.config.set', arguments: {path: 'auth.clientLoginEnabled', value: true}},
        }).catch(() => undefined);
        try {
            await adminPage.goto('/account');
            // With only the admin cookie, the customer GraphQL session
            // resolves to "anonymous" — the account page either
            // redirects to /account/signin OR renders an unauthed
            // empty state. Either way, no admin-shell affordances
            // should bleed through.
            await expect(adminPage.locator('[data-testid^="admin-"]')).toHaveCount(0);
        } finally {
            await request.post(`${serverUrl}/api/mcp/tools/call`, {
                data: {name: 'auth.config.set', arguments: {path: 'auth.clientLoginEnabled', value: false}},
            }).catch(() => undefined);
        }
    });
});
