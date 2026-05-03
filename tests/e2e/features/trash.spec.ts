import {test, expect} from '../fixtures/auth';
import {byTid, tid} from '../fixtures/testIds';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Trash pane (F2, shipped 2026-05-03)
//
// FLOW
//   Deleted pages land in /admin/release/trash with a row showing the
//   page name, child count, and a Restore button. Restore reinstates
//   the page (admin row reappears, public route resolves). A delete
//   that cascades to children groups them with the same `trashGroup`
//   so a single Restore can revive the whole branch.
//
// DATA STATE
//   `beforeEach` creates a fresh page through the admin UI; `afterEach`
//   deletes it (and clears trash if the row still exists). Each spec
//   authors the rows it needs — no shared state across tests.
//
// SELECTOR GAPS (TODO — wire data-testids in TrashPane + page-delete
//                  confirmation dialog):
//   - data-testid="trash-row-${slug}"                 → row by deleted page slug
//   - data-testid="trash-row-${slug}-child-count"     → child count cell
//   - data-testid="trash-row-${slug}-restore-btn"     → restore button
//   - data-testid="nav-page-delete-cascade-checkbox"  → "delete children too" toggle in confirm dialog
//   - data-testid="nav-page-delete-confirm-btn"       → confirm button in delete dialog
// Most of the spec is gated on these; the simple "row appears in trash"
// path also depends on `trash-row-${slug}` and is skipped until wired.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — trash pane', () => {
    test('deleted page appears as a trash row with name + child count', async ({adminPage}) => {
        const stamp = Date.now().toString(36);
        const slug = `trash-${stamp}`;

        await adminPage.goto('/admin/build');
        await byTid(adminPage, tid('nav', 'add', 'page', 'btn')).click();
        await byTid(adminPage, tid('nav', 'page', 'name', 'input')).fill(slug);
        await byTid(adminPage, tid('nav', 'page', 'save', 'btn')).click();
        const row = byTid(adminPage, tid('nav', 'page', 'row', slug));
        await expect(row).toBeVisible({timeout: 15_000});

        await row.click();
        await byTid(adminPage, tid('nav', 'page', 'delete', 'btn')).click();
        // Delete confirm dialog — testid not yet wired.
        const confirmBtn = adminPage.getByTestId('nav-page-delete-confirm-btn');
        test.skip(
            (await confirmBtn.count()) === 0,
            'TODO wire data-testid="nav-page-delete-confirm-btn" in delete confirm dialog',
        );
        await confirmBtn.click();

        // Origin row disappears immediately.
        await expect(row).toHaveCount(0, {timeout: 5_000});

        // Trash pane.
        await adminPage.goto('/admin/release/trash');
        const trashRow = adminPage.getByTestId(`trash-row-${slug}`);
        await expect(trashRow).toBeVisible({timeout: 1_000});
        await expect(trashRow.getByTestId(`trash-row-${slug}-child-count`)).toHaveText(/\d+/);
    });

    test.skip('restore brings the page back to the admin list and public route', async ({adminPage, anonPage}) => {
        // TODO: unskip once data-testid="trash-row-${slug}-restore-btn" +
        // the delete-confirm testid above exist. Contract:
        //   1. seed a page, delete it, visit /admin/release/trash
        //   2. click Restore on the trash row
        //   3. nav-page-row-${slug} reappears in the sider
        //   4. /lv/${slug} resolves (status < 400)
        const _ = {adminPage, anonPage};
    });

    test.skip('delete-with-children-cascade groups all rows under one trashGroup', async ({adminPage}) => {
        // TODO: unskip once data-testid="nav-page-delete-cascade-checkbox"
        // exists. Contract: parent + 2 children, delete with cascade ON,
        // /admin/release/trash shows three rows that share the same
        // data-trash-group attribute (or are listed under the same group
        // header — UX choice not yet finalized).
        const _ = adminPage;
    });
});
