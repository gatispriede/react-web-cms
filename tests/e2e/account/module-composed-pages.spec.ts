import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — /account/* module-composed pages (2026-05-17 pass)
//
// /account home, /account/profile, and /account/verify were ported
// from bespoke JSX to SystemPageDispatch + locked smart-wrapper
// modules (AccountDashboardGrid / AccountProfileForm /
// CustomerVerifyConfirm). These specs assert the three pages still
// render their expected affordances after the port, so a future
// regression in the SystemPage dispatch or the smart-wrapper
// registration chain trips a test instead of a customer.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — /account home module-composed dashboard', () => {
    test('renders the dashboard grid with the orders + addresses + settings cards', async ({customerPage}) => {
        await customerPage.goto('/account');
        await expect(customerPage.getByTestId('page-account-home')).toBeVisible();
        await expect(customerPage.getByTestId('account-dashboard-host')).toBeVisible({timeout: 15_000});

        // The default card set includes orders, addresses, settings — the
        // three entry-points an operator landing on `/account` always
        // expects to see. If any of these go missing the dashboard
        // host's card-build loop has regressed.
        await expect(customerPage.getByTestId('account-dashboard-card-orders')).toBeVisible();
        await expect(customerPage.getByTestId('account-dashboard-card-addresses')).toBeVisible();
        await expect(customerPage.getByTestId('account-dashboard-card-settings')).toBeVisible();
    });
});

test.describe('feature — /account/profile module-composed form pair', () => {
    test('mounts the personal-details card + the password card', async ({customerPage}) => {
        await customerPage.goto('/account/profile');
        await expect(customerPage.getByTestId('page-account-profile')).toBeVisible();
        await expect(customerPage.getByTestId('account-profile-host')).toBeVisible({timeout: 15_000});

        await expect(customerPage.getByTestId('account-profile-card')).toBeVisible();
        await expect(customerPage.getByTestId('account-profile-name')).toBeVisible();
        await expect(customerPage.getByTestId('account-profile-email')).toBeVisible();
        await expect(customerPage.getByTestId('account-profile-save')).toBeVisible();

        await expect(customerPage.getByTestId('account-password-card')).toBeVisible();
        await expect(customerPage.getByTestId('account-password-old')).toBeVisible();
        await expect(customerPage.getByTestId('account-password-new')).toBeVisible();
        await expect(customerPage.getByTestId('account-password-save')).toBeVisible();
    });
});

test.describe('feature — /account/settings module-composed tabbed layout', () => {
    test('renders the settings host with SSR pageProps wired through SystemPageDispatch', async ({customerPage}) => {
        // /account/settings exercises the new pageProps channel: the
        // server-resolved `me + hiddenTabs + enabled` shape is forwarded
        // through SystemPageDispatch to the locked AccountSettingsLayout
        // smart wrapper. If pageProps wiring breaks, the wrapper
        // surfaces its missing-data sentinel instead of the layout.
        await customerPage.goto('/account/settings');
        await expect(customerPage.getByTestId('page-account-settings')).toBeVisible();
        await expect(customerPage.getByTestId('account-settings-host')).toBeVisible({timeout: 15_000});
        // The missing-data sentinel must NOT render — if it does,
        // pageProps didn't reach the smart wrapper.
        await expect(customerPage.getByTestId('account-settings-no-data')).toHaveCount(0);
    });
});

test.describe('feature — /account/verify module-composed magic-link confirm', () => {
    test('shows the missing-token alert when no token is in the URL', async ({anonPage}) => {
        // Defeat-pre-fetch contract: opening /account/verify with no
        // token must NOT consume anything — it must surface the
        // missing-token alert and a `request a new one` link.
        await anonPage.goto('/account/verify');
        await expect(anonPage.getByTestId('page-account-verify')).toBeVisible();
        await expect(anonPage.getByTestId('customer-verify-host')).toBeVisible({timeout: 15_000});
        await expect(anonPage.getByTestId('customer-verify-no-token')).toBeVisible();
    });

    test('shows the confirm button when a token is present', async ({anonPage}) => {
        // A bogus token still renders the confirm button — the token is
        // not validated until the user clicks. This guards the
        // defeat-pre-fetch contract: GET must never consume the token.
        await anonPage.goto('/account/verify?token=test-bogus&callbackUrl=%2Faccount');
        await expect(anonPage.getByTestId('customer-verify-host')).toBeVisible({timeout: 15_000});
        await expect(anonPage.getByTestId('customer-verify-confirm-btn')).toBeVisible();
    });
});
