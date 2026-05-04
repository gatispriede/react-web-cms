import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Themes (admin)
//
// gqty schema regen (2026-04-30) unblocked the direct-page-route
// rendering — `Theme.tsx` at `/admin/client-config/themes` now sees
// the seeded preset grid via `gqty.resolve(query.mongo.getThemes)`.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — themes admin', () => {
    test('admin sees the themes grid', async ({adminPage}) => {
        await adminPage.goto('/admin/client-config/themes');
        await expect(
            adminPage.locator('[data-testid^="themes-list-row-"]').first(),
        ).toBeVisible({timeout: 15_000});
    });

    test('admin can switch the active theme', async ({adminPage}) => {
        await adminPage.goto('/admin/client-config/themes');
        // The currently-active theme's Activate button is disabled — pick
        // the first ENABLED Activate button so the test always switches
        // to a different theme regardless of which one was active.
        const inactiveActivate = adminPage
            .locator('[data-testid="themes-set-active-btn"]:not([disabled])')
            .first();
        await expect(inactiveActivate).toBeVisible({timeout: 10_000});
        await inactiveActivate.click();
        await expect(adminPage.getByText(/theme.*activated/i)).toBeVisible({timeout: 10_000});
    });
});
