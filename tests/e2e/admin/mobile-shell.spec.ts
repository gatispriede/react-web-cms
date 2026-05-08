import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Mobile admin shell (Wave 1 mobile-friendly admin)
//
// Below 768 px the AdminBuildSider replaces its `<Layout.Sider>` with
// a hamburger toggle + `<Drawer>` slide-in. Above 768 px the sider
// renders inline as before. Also covers the dynamic PWA manifest at
// `/admin/manifest.json`.
//
// IMPORTANT: `useIsMobile` reads `window.innerWidth` at mount, so the
// browser context must be created at the mobile viewport BEFORE the
// first navigation — `setViewportSize()` after mount won't re-trigger
// the hook reliably. We therefore spin our own context per test
// instead of using the shared `adminPage` fixture (which is desktop).
// ──────────────────────────────────────────────────────────────────

const IPHONE13 = {width: 390, height: 844};
const DESKTOP = {width: 1440, height: 900};

test.describe('feature — mobile admin shell', () => {
    test('mobile: drawer toggle visible and Sider not inlined', async ({browser, serverUrl, adminStorageState}) => {
        const ctx = await browser.newContext({
            baseURL: serverUrl,
            storageState: adminStorageState,
            viewport: IPHONE13,
            hasTouch: true,
            isMobile: true,
        });
        const page = await ctx.newPage();
        try {
            await page.goto('/admin/build');
            const toggle = page.getByTestId('admin-shell-drawer-toggle');
            await expect(toggle).toBeVisible({timeout: 20_000});
        } finally {
            await ctx.close();
        }
    });

    test('mobile: clicking the toggle opens the drawer; close re-hides it', async ({browser, serverUrl, adminStorageState}) => {
        const ctx = await browser.newContext({
            baseURL: serverUrl,
            storageState: adminStorageState,
            viewport: IPHONE13,
            hasTouch: true,
            isMobile: true,
        });
        const page = await ctx.newPage();
        try {
            await page.goto('/admin/build');
            const toggle = page.getByTestId('admin-shell-drawer-toggle');
            await expect(toggle).toBeVisible({timeout: 20_000});

            // AntD Drawer doesn't render to the DOM while closed, so we
            // can only assert the open state directly.
            await toggle.click();
            const drawer = page.getByTestId('admin-shell-drawer');
            await expect(drawer).toBeVisible();
            await expect(drawer).toHaveAttribute('data-state', 'open');

            // AntD's Drawer mask is rendered as a sibling `<div class="ant-drawer-mask">`.
            // Clicking the mask closes the drawer (onClose).
            await page.locator('.ant-drawer-mask').first().click();
            await expect(drawer).toBeHidden({timeout: 5_000});
        } finally {
            await ctx.close();
        }
    });

    test('desktop: hamburger toggle is not rendered (sider is inline)', async ({browser, serverUrl, adminStorageState}) => {
        const ctx = await browser.newContext({
            baseURL: serverUrl,
            storageState: adminStorageState,
            viewport: DESKTOP,
        });
        const page = await ctx.newPage();
        try {
            await page.goto('/admin/build');
            // Wait for the admin shell to mount — any heading inside /admin/build
            // would do; the AntD Sider uses role=complementary or just a div, so
            // we wait for the body sentinel from AdminBuildSider.
            await expect(page.getByTestId('admin-build-sider-body').first())
                .toBeVisible({timeout: 20_000});
            // Hamburger toggle exists only on mobile.
            await expect(page.getByTestId('admin-shell-drawer-toggle')).toHaveCount(0);
        } finally {
            await ctx.close();
        }
    });

    test('manifest.json: served as JSON with admin metadata', async ({anonPage}) => {
        // Manifest is public (no auth gate); use anonPage so we don't drag
        // a NextAuth cookie through and accidentally reveal a redirect.
        const res = await anonPage.request.get('/admin/manifest.json');
        expect(res.status()).toBe(200);
        const ct = res.headers()['content-type'] ?? '';
        expect(ct).toMatch(/manifest\+json|application\/json/);
        const body = await res.json();
        expect(body.name).toBe('Funisimo CMS Admin');
        expect(body.display).toBe('standalone');
        expect(body.start_url).toBe('/admin/');
        expect(body.scope).toBe('/admin/');
        expect(Array.isArray(body.icons)).toBe(true);
        expect(body.icons.length).toBeGreaterThan(0);
    });
});
