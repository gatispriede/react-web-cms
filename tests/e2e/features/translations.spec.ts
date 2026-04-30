import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Translations
//
// Admin opens /admin/content/translations and confirms the surface
// mounts (key-value table + language tabs). Editing a key + asserting
// the public reflects it is the same `triggerRevalidate({scope:'i18n'})`
// path that the smoke step 8 already covers; this spec adds a non-smoke
// regression guard for the page mount.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — translations admin', () => {
    test('admin can open the translations page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/translations');
        // Languages page renders a Tabs strip with the language codes.
        await expect(
            adminPage.locator('.ant-tabs, .ant-table').first(),
        ).toBeVisible({timeout: 15_000});
    });
});
