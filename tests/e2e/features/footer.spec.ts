import {test, expect} from '../fixtures/auth';
import {byTid, tid} from '../fixtures/testIds';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Footer copyright
//
// Admin edits the footer copyright on /admin/content/footer; expects
// a save confirmation. Public render assertion is a `fixme` — the
// footer copy is bundled into the prod build at build time and ISR
// refresh is the same scope-all path that affects the module specs.
// ──────────────────────────────────────────────────────────────────

const newCopyright = `© e2e ${Date.now().toString(36)}`;

test.describe.serial('feature — footer admin + client', () => {
    test('admin updates the footer copyright', async ({adminPage}) => {
        await adminPage.goto('/admin/content/footer');
        const copyrightInput = byTid(adminPage, tid('footer', 'copyright', 'input'));
        // Wait for the async-loaded current value before overwriting,
        // otherwise the post-mount refresh stomps the typed value.
        await expect(copyrightInput).not.toHaveValue('', {timeout: 10_000});
        await copyrightInput.fill(newCopyright);
        await byTid(adminPage, tid('footer', 'save', 'btn')).click();
        await expect(adminPage.getByText(/footer.*saved|saved/i).first())
            .toBeVisible({timeout: 10_000});
    });

    test('public site reflects the new copyright', async ({anonPage}) => {
        // ISR regen for footer is async — poll-with-reload to ride out
        // the regen window. Same pattern as the module harness's
        // `assertPublicMarker`.
        const deadline = Date.now() + 30_000;
        let body = '';
        while (Date.now() < deadline) {
            await anonPage.goto(`/lv/?ts=${Date.now()}`);
            body = (await anonPage.textContent('body')) ?? '';
            if (body.includes(newCopyright)) return;
            await anonPage.waitForTimeout(750);
        }
        throw new Error(`footer copyright "${newCopyright}" not found. Body: "${body.slice(0, 200)}"`);
    });
});
