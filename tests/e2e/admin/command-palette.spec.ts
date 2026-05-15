import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Admin command palette (Ctrl+K / Cmd+K)
//
// Press Ctrl+K from inside `/admin`. The cmdk search field mounts.
// Typing a known query narrows results. Enter activates the top result.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — admin command palette', () => {
    test('Ctrl+K opens the palette and Enter navigates', async ({adminPage}) => {
        await adminPage.goto('/admin/build');

        // Wait until shell is interactive — admin sider rendered.
        await expect(adminPage.getByTestId('admin-shell-drawer-toggle').or(
            adminPage.locator('aside, nav').first(),
        )).toBeVisible({timeout: 20_000});

        await adminPage.keyboard.press('Control+KeyK');

        const search = adminPage.getByTestId('cmdk-search');
        await expect(search).toBeVisible({timeout: 5_000});

        await search.fill('themes');
        // Some matching result row should show.
        await expect(adminPage.locator('[data-testid^="cmdk-result-"]').first()).toBeVisible({timeout: 5_000});
        await adminPage.keyboard.press('Enter');

        // Palette should close after activation.
        await expect(search).toBeHidden({timeout: 5_000});
    });
});
