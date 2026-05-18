import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Customer magic-link request
//
// Submitting an email at /account/magic-link should resolve to a
// "check your inbox" confirmation state (testid: customer-magic-link-sent).
// Verifying the token itself requires fishing it out of the DB —
// scoped down here to the request leg; token-verify is wired but
// gated on the email pipeline in dev (Resend not configured).
// ──────────────────────────────────────────────────────────────────

test.describe('feature — customer magic link', () => {
    test('submitting an email shows the sent confirmation', async ({anonPage}) => {
        await anonPage.goto('/account/magic-link');

        const stamp = Date.now().toString(36);
        await anonPage.getByTestId('customer-magic-email-input').fill(`magic-${stamp}@example.test`);
        await anonPage.getByTestId('customer-magic-submit-btn').click();

        await expect(anonPage.getByTestId('customer-magic-link-sent')).toBeVisible({timeout: 10_000});
    });
});
