import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Users (admin management)
//
// Admin opens /admin/system/users and adds a new editor-role user via
// the Add user modal. Confirms the row appears in the table.
//
// Recently fixed: hydration mismatch on the Modal Portal (forceRender
// during SSR). This spec also doubles as a regression guard against
// that — if the modal won't open, the test fails fast.
// ──────────────────────────────────────────────────────────────────

const newUser = {
    email: `e2e-editor-${Date.now().toString(36)}@e2e.local`,
    name: 'E2E Editor',
    password: 'editor-test-pw',
};

test.describe.serial('feature — users admin management', () => {
    test('admin adds a new editor-role user', async ({adminPage}) => {
        await adminPage.goto('/admin/system/users');
        await adminPage.getByRole('button', {name: /add user/i}).click();

        await adminPage.getByLabel(/email/i).fill(newUser.email);
        await adminPage.getByLabel(/^name$/i).fill(newUser.name);
        // Password field shows up only on create.
        await adminPage.getByLabel(/^password$/i).fill(newUser.password);

        await adminPage.getByRole('button', {name: /^create$/i}).click();
        await expect(adminPage.getByText(newUser.email)).toBeVisible({timeout: 10_000});
    });

    test('admin can re-open the user row to edit', async ({adminPage}) => {
        await adminPage.goto('/admin/system/users');
        const row = adminPage.getByRole('row', {name: new RegExp(newUser.email)});
        await expect(row).toBeVisible({timeout: 10_000});
        await row.getByRole('button', {name: /edit/i}).click();
        // Edit modal opens with the email field disabled (existing-user guard).
        await expect(adminPage.getByLabel(/email/i)).toBeDisabled();
    });
});
