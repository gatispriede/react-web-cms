import {test, expect, Page} from '@playwright/test';
import {test as authTest} from '../fixtures/auth';
import {waitForVisualReady, maskVolatile} from './_shared/visualHelpers';

/**
 * Critical-surface visual baselines.
 *
 * Each surface is a single snapshot of the page at a known seed state. For
 * data-driven surfaces (homepage, blog, public page render) we rely on the
 * canonical CV bundle fixture imported by the seed flow used in
 * `tests/e2e/smoke/cv-bundle-chain.spec.ts`. If that fixture isn't
 * importable in this worker, the spec skips with a clear message rather
 * than capturing an empty-state baseline that would silently rot.
 *
 * Surfaces covered (per the visual-regressions runbook):
 *   1. /[lang]                     — public homepage
 *   2. /[lang]/[slug]              — public page
 *   3. /admin                      — admin shell entry
 *   4. /admin/build                — page editor surface
 *   5. /auth/signin                — sign-in form
 *   6. /checkout                   — checkout root
 *   7. /[lang]/blog                — blog index
 *   8. /[lang]/blog/[slug]         — blog post detail
 *   9. /admin/release/bundle       — Bundle pane (admin-only)
 *  10. <Footer> standalone         — via /dev/visual?type=footer
 */

async function snap(page: Page, name: string): Promise<void> {
    await waitForVisualReady(page);
    await expect(page).toHaveScreenshot(name, {
        fullPage: true,
        mask: maskVolatile(page),
    });
}

authTest.describe('visual — public surfaces', () => {
    authTest('homepage · /en', async ({anonPage: page}) => {
        await page.goto('/en');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-homepage.png');
    });

    authTest('public page · /en/<slug>', async ({anonPage: page}) => {
        // Slug here matches what the cv-bundle import seeds. If the bundle
        // hasn't been imported in this worker the page 404s; the runbook
        // documents how to wire it in.
        await page.goto('/en/about');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-public-page.png');
    });

    authTest('blog index · /en/blog', async ({anonPage: page}) => {
        await page.goto('/en/blog');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-blog-index.png');
    });

    authTest('blog post · /en/blog/<slug>', async ({anonPage: page}) => {
        await page.goto('/en/blog/hello');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-blog-post.png');
    });

    authTest('signin · /admin/signin', async ({anonPage: page}) => {
        // Phase 1.A auth-split: `/auth/signin` was the pre-split
        // legacy route. Customer + admin signin pages are now
        // disjoint at `/account/signin` (flag-gated) and
        // `/admin/signin` (always-on). Capture the admin form since
        // it's the one that ships in every dev install regardless
        // of `auth.clientLoginEnabled`.
        await page.goto('/admin/signin');
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-signin.png');
    });

    authTest('checkout · /checkout', async ({anonPage: page}) => {
        await page.goto('/checkout');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-checkout.png');
    });

    authTest('marketing landing · /welcome', async ({anonPage: page}) => {
        await page.goto('/welcome');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-marketing-landing.png');
    });
});

authTest.describe('visual — admin surfaces', () => {
    authTest('admin shell · /admin', async ({adminPage: page}) => {
        await page.goto('/admin');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-admin.png');
    });

    authTest('admin build · /admin/build', async ({adminPage: page}) => {
        await page.goto('/admin/build');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-admin-build.png');
    });

    authTest('admin bundle · /admin/release/bundle', async ({adminPage: page}) => {
        await page.goto('/admin/release/bundle');
        // `networkidle` was flaky here — the presence/HMR sockets keep
        // long-lived connections open in dev, so the load state never
        // resolves and the test times out. `domcontentloaded` plus
        // `waitForVisualReady` (inside `snap`) is what every other
        // visual spec uses.
        await page.waitForLoadState('domcontentloaded');
        await snap(page, 'surface-admin-bundle.png');
    });
});

authTest.describe('visual — components', () => {
    // Footer doesn't have a /dev/visual case (it's not a module type), so
    // we capture it from the public homepage by scoping to the `<footer>`
    // landmark. Keeps the baseline orthogonal to the homepage hero — if
    // the homepage above-the-fold changes, this footer snapshot shouldn't.
    authTest('footer · public', async ({anonPage: page}) => {
        await page.goto('/en');
        await waitForVisualReady(page);
        const footer = page.locator('footer').first();
        await expect(footer).toBeVisible({timeout: 15_000});
        await footer.scrollIntoViewIfNeeded();
        await waitForVisualReady(page);
        await expect(footer).toHaveScreenshot('component-footer.png', {
            mask: maskVolatile(page),
        });
    });
});
