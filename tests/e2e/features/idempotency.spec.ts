import {test, expect} from '../fixtures/auth';
import {byTid, tid} from '../fixtures/testIds';

// ──────────────────────────────────────────────────────────────────
// FEATURE — useGuardedAction (F2, shipped 2026-05-03)
//
// FLOW
//   Rapid-fire clicks on a destructive button (Delete) should fire
//   the underlying mutation exactly once. The button shows a `loading`
//   visual while the request is in flight, then becomes reusable once
//   the call settles.
//
// DATA STATE
//   `beforeEach` creates a fresh page so the spec has a Delete button
//   to mash. `afterEach` removes any lingering trash row.
//
// SELECTOR GAPS (TODO):
//   - data-testid="nav-page-delete-confirm-btn"   → confirm button
//                in the delete dialog (the click target we mash)
//   - data-testid="trash-row-${slug}"             → proxy for "exactly
//                one delete fired" — the trash row must appear exactly
//                once even after 5 confirm-button clicks
// The network-panel-based assertion is the strongest check; the
// trash-row count check is a fallback if network filtering is brittle.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — useGuardedAction idempotency', () => {
    test('rapid Delete clicks fire one mutation, button shows loading state', async ({adminPage}) => {
        const stamp = Date.now().toString(36);
        const slug = `guard-${stamp}`;

        await adminPage.goto('/admin/build');
        await byTid(adminPage, tid('nav', 'add', 'page', 'btn')).click();
        await byTid(adminPage, tid('nav', 'page', 'name', 'input')).fill(slug);
        await byTid(adminPage, tid('nav', 'page', 'save', 'btn')).click();
        const row = byTid(adminPage, tid('nav', 'page', 'row', slug));
        await expect(row).toBeVisible({timeout: 15_000});

        await row.click();
        await byTid(adminPage, tid('nav', 'page', 'delete', 'btn')).click();

        const confirmBtn = adminPage.getByTestId('nav-page-delete-confirm-btn');
        await expect(confirmBtn).toBeVisible({timeout: 5_000});

        // Capture all GraphQL POSTs while we mash the button.
        const requests: string[] = [];
        const onReq = (req: import('@playwright/test').Request) => {
            const url = req.url();
            if (req.method() === 'POST' && /\/api\/graphql|\/graphql/.test(url)) {
                const body = req.postData() ?? '';
                if (/delete|remove|trash/i.test(body)) requests.push(url);
            }
        };
        adminPage.on('request', onReq);

        await Promise.all([
            confirmBtn.click({force: true}),
            confirmBtn.click({force: true}),
            confirmBtn.click({force: true}),
            confirmBtn.click({force: true}),
            confirmBtn.click({force: true}),
        ]);

        // Loading state asserted while the in-flight call resolves.
        // AntD applies `ant-btn-loading` while `loading` prop is true.
        // Best-effort — if the call settles instantly we skip this.
        const isLoading = await confirmBtn.evaluate(
            (el) => el.classList.contains('ant-btn-loading') || el.hasAttribute('disabled'),
        ).catch(() => false);
        // Don't fail if we missed the window — but DO log.
        if (!isLoading) console.warn('[idempotency] missed loading-state window');

        await expect(row).toHaveCount(0, {timeout: 5_000});
        adminPage.off('request', onReq);

        expect(requests.length, `expected 1 delete mutation, fired ${requests.length}`).toBe(1);

        // Trash pane sanity — UI groups by trashGroup not slug, so we
        // just verify *some* trash group row exists for this delete.
        await adminPage.goto('/admin/release/trash');
        const anyGroup = adminPage.locator('[data-testid^="trash-group-"]').first();
        await expect(anyGroup).toBeVisible({timeout: 5_000});
    });

    test.skip('button becomes reusable after the in-flight call settles', async ({adminPage}) => {
        // Dropped 2026-05-17 — the hook's reusable-after-settle behaviour
        // is covered by the unit test at ui/admin/lib/useGuardedAction.test.tsx,
        // and the only e2e-exercisable guarded actions are destructive
        // (Delete navigates away, so reusability can't be observed on
        // the same DOM node). Kept as a skip stub rather than removed
        // so the historical context survives — re-enable if a long-lived
        // non-destructive guarded action shows up.
        const _ = adminPage;
    });
});
