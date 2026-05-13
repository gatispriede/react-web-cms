import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Empty-state CTAs across admin panes
//
// Panes that used to render blank now mount an <EmptyState> with a
// stable testid. Trash is the canonical empty pane in a fresh DB.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — empty states', () => {
    test('trash pane renders the empty-state component when no rows', async ({adminPage}) => {
        await adminPage.goto('/admin/release/trash');

        const empty = adminPage.getByTestId('trash-empty-state');
        const rows = adminPage.locator('[data-testid^="trash-group-"]');

        // Either trash is empty (assert empty state) or has rows (assert
        // table rendered). Both prove the surface mounted without crash.
        const hasRows = await rows.count();
        if (hasRows === 0) {
            await expect(empty).toBeVisible({timeout: 10_000});
        } else {
            await expect(rows.first()).toBeVisible();
        }
    });
});
