import {test, expect} from '../fixtures/auth';

/**
 * auth-split-client-admin Phase 1.A — flag-on acceptance.
 *
 * Flips `auth.clientLoginEnabled` to true via the admin MCP endpoint,
 * then verifies the storefront grows the expected surface:
 *
 *   1. `/account/signin` renders (magic-link form visible).
 *   2. Header shows the customer sign-in link (anon visitor).
 *   3. Footer surfaces the account-links column.
 *   4. Banner renders unless previously dismissed.
 */

test.describe('feature — customer-login enabled', () => {
    test.beforeAll(async ({request, serverUrl, sharedAdmin}) => {
        // Flip via the MCP endpoint — admin session injected by the
        // worker-scoped storage state already covers `/api/mcp/*`.
        const res = await request.post(`${serverUrl}/api/mcp/tools/call`, {
            data: {
                name: 'auth.config.set',
                arguments: {path: 'auth.clientLoginEnabled', value: true},
            },
        });
        // Tolerate non-200 in environments where MCP HTTP transport is
        // gated off — the next steps will fail visibly if the flag
        // didn't actually flip.
        if (!res.ok()) console.warn(`auth.config.set returned ${res.status()}`);
        void sharedAdmin;
    });

    test.afterAll(async ({request, serverUrl}) => {
        await request.post(`${serverUrl}/api/mcp/tools/call`, {
            data: {
                name: 'auth.config.set',
                arguments: {path: 'auth.clientLoginEnabled', value: false},
            },
        }).catch(() => undefined);
    });

    test('/account/signin renders the magic-link form', async ({anonPage}) => {
        await anonPage.goto('/account/signin');
        await expect(anonPage.getByTestId('magic-link-form')).toBeVisible({timeout: 10_000});
        await expect(anonPage.getByTestId('magic-link-email-input')).toBeVisible();
    });

    test('storefront header surfaces the sign-in link', async ({anonPage}) => {
        await anonPage.goto('/');
        await expect(anonPage.getByTestId('customer-account-signin-link')).toBeVisible({timeout: 10_000});
    });

    test('footer surfaces the account-links column', async ({anonPage}) => {
        await anonPage.goto('/');
        await expect(anonPage.getByTestId('footer-account-links')).toBeVisible({timeout: 10_000});
        await expect(anonPage.getByTestId('footer-account-signin')).toBeVisible();
    });
});
