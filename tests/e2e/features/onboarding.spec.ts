import {test, expect} from '../fixtures/auth';

/**
 * Q7 — onboarding wizard e2e.
 *
 * The full 3-step happy path requires a fresh install (no admin), but the
 * test harness seeds one in `seededAdmin`. We verify the contract that
 * matters most for safety: once an admin exists, the wizard route 307s
 * to `/admin/build` so the bootstrap can't be re-run.
 *
 * The 3-step click-through is covered by the unit-level VM tests; the
 * mongo-side bootstrap is covered by `OnboardingService.test.ts`. A
 * full anon-fresh-install e2e is deferred until the harness gains a
 * "drop Users collection then start server" mode.
 */
test.describe('onboarding wizard', () => {
    test('redirects to /admin/build when an admin already exists', async ({seededAdmin, anonPage}) => {
        // Touch seededAdmin so the fixture runs (seeds the admin).
        expect(seededAdmin.email).toBeTruthy();
        await anonPage.goto('/admin/onboarding');
        await expect(anonPage).toHaveURL(/\/admin\/build/);
    });
});
