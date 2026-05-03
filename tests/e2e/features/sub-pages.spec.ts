import {test, expect} from '../fixtures/auth';
import {byTid, tid} from '../fixtures/testIds';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Sub-pages (F1, shipped 2026-05-03)
//
// FLOW
//   Hierarchical page nesting up to depth 3 (parent → child → grandchild).
//   Public path resolves through the chain; depth-4 + cycles are rejected
//   server-side; the Parent <Select> in the admin disables descendants of
//   the page being edited so a user cannot author a cycle in the UI.
//
// DATA STATE
//   No prior data. `beforeEach` is unnecessary because the spec authors
//   the parent/child/grandchild itself; `afterEach` deletes the parent
//   (cascades through trash if F2 is in effect, otherwise the rows linger
//   harmlessly in this worker's mongo since each worker gets its own DB).
//
// SELECTOR GAPS (TODO — wire data-testids in AddNewDialogNavigation +
//                  the sub-page admin surface):
//   - data-testid="nav-page-parent-select"               → parent <Select> in new-page dialog
//   - data-testid="nav-page-parent-option-${slug}"       → option row in the parent select
//   - data-testid="nav-page-parent-option-${slug}-disabled" → flagged as disabled in cycle-prevention
//   - data-testid="nav-page-depth-error-toast"           → server-side depth-4 reject toast
//   - data-testid="nav-page-cycle-error-toast"           → server-side cycle reject toast
// Most of the chain below skips on missing testids; the public-resolution
// + 404 paths run today against the existing nav-page-row testids.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — sub-pages', () => {
    test('public path resolves through 3-level page chain', async ({adminPage, anonPage}) => {
        const stamp = Date.now().toString(36);
        const parent = `parent-${stamp}`;
        const child = `child-${stamp}`;
        const grand = `grand-${stamp}`;

        // Create parent through the existing new-page dialog. Child +
        // grandchild creation requires a parent <Select> that doesn't yet
        // expose a data-testid — flagged in the file header.
        await adminPage.goto('/admin/build');
        await byTid(adminPage, tid('nav', 'add', 'page', 'btn')).click();
        await byTid(adminPage, tid('nav', 'page', 'name', 'input')).fill(parent);
        await byTid(adminPage, tid('nav', 'page', 'save', 'btn')).click();
        await expect(byTid(adminPage, tid('nav', 'page', 'row', parent))).toBeVisible({timeout: 15_000});

        const parentSelect = adminPage.getByTestId('nav-page-parent-select');
        test.skip(
            (await parentSelect.count()) === 0,
            'TODO wire data-testid="nav-page-parent-select" in AddNewDialogNavigation',
        );

        // Child under parent.
        await byTid(adminPage, tid('nav', 'add', 'page', 'btn')).click();
        await byTid(adminPage, tid('nav', 'page', 'name', 'input')).fill(child);
        await parentSelect.click();
        await adminPage.getByTestId(`nav-page-parent-option-${parent}`).click();
        await byTid(adminPage, tid('nav', 'page', 'save', 'btn')).click();
        await expect(byTid(adminPage, tid('nav', 'page', 'row', child))).toBeVisible({timeout: 15_000});

        // Grandchild under child.
        await byTid(adminPage, tid('nav', 'add', 'page', 'btn')).click();
        await byTid(adminPage, tid('nav', 'page', 'name', 'input')).fill(grand);
        await parentSelect.click();
        await adminPage.getByTestId(`nav-page-parent-option-${child}`).click();
        await byTid(adminPage, tid('nav', 'page', 'save', 'btn')).click();
        await expect(byTid(adminPage, tid('nav', 'page', 'row', grand))).toBeVisible({timeout: 15_000});

        await anonPage.goto(`/lv/${parent}/${child}/${grand}`);
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
        await expect(anonPage).not.toHaveURL(/\/404|\/_error/);
    });

    test('public path 404s on a missing child', async ({anonPage}) => {
        const resp = await anonPage.goto(`/lv/parent-no-such-${Date.now().toString(36)}/missing`);
        // Either Next renders the 404 page (status 404) or redirects to /404.
        expect(resp?.status()).toBeGreaterThanOrEqual(400);
    });

    test.skip('admin attempt at depth-4 is rejected server-side', async ({adminPage}) => {
        // TODO: unskip once data-testid="nav-page-parent-select" +
        // data-testid="nav-page-depth-error-toast" exist. The contract:
        // selecting a grandchild as parent for a 4th-level page must trip
        // the toast, the page row must NOT appear in the sider.
        await adminPage.goto('/admin/build');
    });

    test.skip('admin attempt to set a page as its own ancestor is rejected', async ({adminPage}) => {
        // TODO: unskip once data-testid="nav-page-cycle-error-toast" exists.
        // The contract: editing parent + selecting one of its descendants
        // as the new parent must trip the toast and leave the chain intact.
        await adminPage.goto('/admin/build');
    });

    test.skip('Parent <Select> disables descendants of the page being edited', async ({adminPage}) => {
        // TODO: unskip once data-testid="nav-page-parent-option-${slug}"
        // is decorated with a disabled marker (e.g. aria-disabled="true").
        // The contract: open the Edit form for `parent`, the parent select
        // must show `child` and `grand` as disabled options.
        await adminPage.goto('/admin/build');
    });
});
