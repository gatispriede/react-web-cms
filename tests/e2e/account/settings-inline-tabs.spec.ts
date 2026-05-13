import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Phase 1.E follow-up: notifications + privacy tabs render
// inline inside /account/settings (no deep-link page redirect).
//
// Mirrors the gate-aware pattern from settings-tabs.spec.ts — when
// auth.clientLoginEnabled is off or the visitor isn't signed in, the
// page redirects out and we skip. When reachable, the inline forms'
// testids (account-notifications-page / account-privacy-page) must
// appear without the URL changing.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — account settings inline notif + privacy tabs', () => {
    test('notifications tab mounts NotificationPreferencesForm inline', async ({anonPage}) => {
        const res = await anonPage.goto('/account/settings?tab=notifications');
        if (res?.status() === 404) test.skip(true, 'auth.clientLoginEnabled off — gate skipped');

        const url = anonPage.url();
        if (/\/account\/signin/.test(url)) test.skip(true, 'unauthenticated — redirected to signin');

        // URL must still be /account/settings (no deep-link redirect).
        expect(url).toMatch(/\/account\/settings/);
        expect(url).toMatch(/tab=notifications/);

        // Inline form is mounted with the original W8f testid.
        await expect(anonPage.getByTestId('account-notifications-page')).toBeVisible();
        await expect(anonPage.getByTestId('account-settings-tab-notifications')).toBeVisible();
    });

    test('privacy tab mounts DataRightsForm inline', async ({anonPage}) => {
        const res = await anonPage.goto('/account/settings?tab=privacy');
        if (res?.status() === 404) test.skip(true, 'auth.clientLoginEnabled off — gate skipped');

        const url = anonPage.url();
        if (/\/account\/signin/.test(url)) test.skip(true, 'unauthenticated — redirected to signin');

        expect(url).toMatch(/\/account\/settings/);
        expect(url).toMatch(/tab=privacy/);

        await expect(anonPage.getByTestId('account-privacy-page')).toBeVisible();
        await expect(anonPage.getByTestId('account-settings-tab-privacy')).toBeVisible();
    });

    test('legacy /account/notifications redirects to settings tab', async ({anonPage}) => {
        const res = await anonPage.goto('/account/notifications');
        if (res?.status() === 404) test.skip(true, 'auth.clientLoginEnabled off — gate skipped');

        const url = anonPage.url();
        if (/\/account\/signin/.test(url)) test.skip(true, 'unauthenticated — redirected to signin');
        expect(url).toMatch(/\/account\/settings\?tab=notifications/);
    });

    test('legacy /account/privacy redirects to settings tab', async ({anonPage}) => {
        const res = await anonPage.goto('/account/privacy');
        if (res?.status() === 404) test.skip(true, 'auth.clientLoginEnabled off — gate skipped');

        const url = anonPage.url();
        if (/\/account\/signin/.test(url)) test.skip(true, 'unauthenticated — redirected to signin');
        expect(url).toMatch(/\/account\/settings\?tab=privacy/);
    });
});
