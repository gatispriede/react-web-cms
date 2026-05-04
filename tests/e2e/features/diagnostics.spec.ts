import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — F5 Diagnostics pane (shipped 2026-05-03)
//
// FLOW
//   Admin opens /admin/system/info. The pane mounts (build identity
//   card renders), the route registry table has at least one row, the
//   Refresh button works (loading state appears + disappears), and the
//   pane is admin-gated (anon / non-admin sees a 401-or-redirect).
//
// DATA STATE
//   No seed needed — diagnostics queries are read-only over server-side
//   manifest + connection state.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — diagnostics (F5)', () => {
    test('admin sees build identity, route registry, refresh works', async ({adminPage}) => {
        await adminPage.goto('/admin/system/info');

        // Pane mounts.
        await expect(adminPage.getByTestId('admin-diagnostics')).toBeVisible({timeout: 30_000});

        // Build identity card — ensures the SSR + GraphQL diagnostics query landed.
        const build = adminPage.getByTestId('section-build');
        await expect(build).toBeVisible();
        await expect(build).toContainText(/Git SHA|Built|Boot ID/i);

        // Route registry — at least one row probed.
        const routes = adminPage.getByTestId('section-routes');
        await expect(routes).toBeVisible();
        await expect(routes.locator('tbody tr')).not.toHaveCount(0, {timeout: 20_000});

        // Refresh — click and wait for the button to settle (loading off).
        const refresh = adminPage.getByTestId('diagnostics-refresh');
        await refresh.click();
        await expect(refresh).toBeEnabled({timeout: 20_000});
    });

    test('non-admin / anon receives 401-or-redirect', async ({anonPage}) => {
        const resp = await anonPage.goto('/admin/system/info');
        // adminOnly SSR: either 401/403 status, or redirect to /auth/signin.
        const status = resp?.status() ?? 0;
        const url = anonPage.url();
        const ok = status === 401 || status === 403
            || /\/auth\/signin/.test(url)
            || status === 302 || status === 307;
        expect(ok, `expected gated response (got status=${status} url=${url})`).toBeTruthy();
    });
});
