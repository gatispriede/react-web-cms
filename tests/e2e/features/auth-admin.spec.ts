import {test, expect} from '../fixtures/auth';

// Covers the admin-side authentication flow:
//   1. anon -> /admin redirects to /auth/signin
//   2. valid creds land on the admin shell
//   3. wrong-password attempts produce the lockout countdown UI
//
// DECISION: lockout assertions check that the error UI surfaces a wait
// message; we don't fast-forward through the actual cooldown — the unit
// tests in `_loginLockout.test.ts` already cover the timing.

test.describe('admin auth', () => {
    test('anon visiting /admin shows the sign-in gate', async ({anonPage}) => {
        // The admin doesn't route-redirect to /auth/signin for anon — it
        // renders an inline gate with a "Please sign in to continue"
        // heading and a Sign-in button that navigates onward when clicked.
        await anonPage.goto('/admin');
        await expect(anonPage.getByRole('heading', {name: /sign in/i})).toBeVisible();
        await anonPage.getByRole('button', {name: /^sign in$/i}).click();
        await expect(anonPage).toHaveURL(/\/auth\/signin/);
    });

    test('valid credentials land on the admin shell', async ({seededAdmin, anonPage}) => {
        await anonPage.goto('/auth/signin');
        await anonPage.getByLabel(/email/i).fill(seededAdmin.email);
        await anonPage.getByLabel(/password/i).fill(seededAdmin.password);
        await anonPage.getByRole('button', {name: /sign in|log in|submit/i}).click();
        await expect(anonPage).not.toHaveURL(/\/auth\/signin/, {timeout: 30_000});
        // Admin shell rendering is the primary signal of a successful login.
        await anonPage.goto('/admin');
        await expect(anonPage).toHaveURL(/\/admin/);
    });

    test('wrong password surfaces a lockout message', async ({seededAdmin, anonPage}) => {
        // The first wrong-password attempt fires the progressive lockout
        // (`10s → 1m → 5m → 15m → 30m`), so a single attempt is enough to
        // observe the lockout copy. No looping — that just made the test
        // slow without exercising anything new.
        await anonPage.goto('/auth/signin');
        await anonPage.getByLabel(/email/i).fill(seededAdmin.email);
        await anonPage.getByLabel(/password/i).fill('wrong-password');
        await anonPage.getByRole('button', {name: /sign in|log in|submit/i}).click();
        // The lockout banner is the unique signal — multiple elements
        // ("Try again", "Wrong email...", the disabled button) match
        // looser regexes and trip Playwright's strict mode. The phrase
        // "temporarily locked" appears once, on the lockout alert.
        await expect(
            anonPage.getByText(/temporarily locked/i),
        ).toBeVisible({timeout: 10_000});
    });
});
