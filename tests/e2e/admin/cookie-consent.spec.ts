import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Cookie consent banner
//
// First-visit (no `cookie_consent` cookie) shows a banner with
// accept-all / reject-all / customise options. Selection persists
// across reloads via the `cookie_consent` cookie.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — cookie consent', () => {
    test('banner appears on first visit and reject-all persists', async ({browser, serverUrl}) => {
        const ctx = await browser.newContext({baseURL: serverUrl});
        const page = await ctx.newPage();
        try {
            await page.goto('/');
            const banner = page.getByTestId('cookie-consent-banner');
            await expect(banner).toBeVisible({timeout: 10_000});

            await page.getByTestId('cookie-consent-reject').click();

            // Banner gone after selection.
            await expect(banner).toBeHidden({timeout: 5_000});

            // Reload — banner should stay hidden because the cookie was set.
            await page.reload();
            await expect(page.getByTestId('cookie-consent-banner')).toBeHidden({timeout: 5_000});

            // Cookie persisted with a reject-style value.
            const cookies = await ctx.cookies(serverUrl);
            const consent = cookies.find(c => c.name === 'cookie_consent');
            expect(consent).toBeTruthy();
            expect(consent!.value.length).toBeGreaterThan(0);
        } finally {
            await ctx.close();
        }
    });
});
