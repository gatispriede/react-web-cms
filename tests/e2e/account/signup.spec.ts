import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Customer signup
//
// Submitting the signup form either auto-creates a session or surfaces
// an email-verify CTA. Either path proves the form wires through to
// the backend; this spec asserts the form mounts and submit resolves.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — customer signup', () => {
    test('submitting the signup form resolves (session or verify CTA)', async ({anonPage}) => {
        await anonPage.goto('/account/signup');

        const stamp = Date.now().toString(36);
        await anonPage.getByTestId('customer-signup-name-input').fill(`E2E ${stamp}`);
        await anonPage.getByTestId('customer-signup-email-input').fill(`e2e-${stamp}@example.test`);
        await anonPage.getByTestId('customer-signup-password-input').fill(`Pw-${stamp}-AaBb1!`);
        await anonPage.getByTestId('customer-signup-submit-btn').click();

        // Either we land on a customer area, or we see a verify CTA / toast.
        await expect.poll(async () => {
            const url = anonPage.url();
            if (!/\/account\/signup/.test(url)) return 'navigated';
            const verify = await anonPage.locator(':text-matches("verify|check your inbox|sent", "i")').first().isVisible().catch(() => false);
            if (verify) return 'verify';
            const toast = await anonPage.locator('[data-sonner-toast]').first().isVisible().catch(() => false);
            if (toast) return 'toast';
            return 'pending';
        }, {timeout: 15_000}).not.toBe('pending');
    });
});
