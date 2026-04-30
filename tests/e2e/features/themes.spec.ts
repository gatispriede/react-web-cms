import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Themes (admin)
//
// `ROADMAP #13` — when Theme.tsx mounts as a direct page route (not
// inside the legacy tabbed AdminSettings shell), gqty's `resolve(...)`
// for `mongo.getThemes` returns empty even though direct fetch works.
// The whole describe is `fixme` until the gqty/page-tree initialization
// gap is resolved. Until then, smoke step 7 stays skipped too.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — themes admin', () => {
    test.fixme('admin sees the themes grid', async ({adminPage}) => {
        await adminPage.goto('/admin/client-config/themes');
        await expect(
            adminPage.locator('[data-testid^="themes-list-row-"]').first(),
        ).toBeVisible({timeout: 15_000});
    });

    test.fixme('admin can switch the active theme', async ({adminPage}) => {
        await adminPage.goto('/admin/client-config/themes');
        const setActiveBtns = adminPage.locator('[data-testid="themes-set-active-btn"]');
        await setActiveBtns.first().click();
        await expect(adminPage.getByText(/theme.*activated/i)).toBeVisible({timeout: 10_000});
    });
});
