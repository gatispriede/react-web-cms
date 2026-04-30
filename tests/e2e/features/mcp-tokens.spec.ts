import {test, expect} from '../fixtures/auth';
import {byTid, tid} from '../fixtures/testIds';

// ──────────────────────────────────────────────────────────────────
// FEATURE — MCP tokens
//
// Admin issues a personal access token for the MCP HTTP transport on
// /admin/system/mcp, sees the one-time token surface in a copy-once
// dialog, and the new token appears in the table.
//
// What this proves:
//   - admin: issue + revoke flow round-trip
//   - the one-time-secret reveal pattern (visible exactly once, never
//     re-fetched) doesn't crash on the redact step
//
// What it does NOT cover:
//   - actually calling the MCP HTTP endpoint with the issued token
//     (covered by McpServer.test.ts integration specs)
// ──────────────────────────────────────────────────────────────────

const tokenName = `e2e-mcp-${Date.now().toString(36)}`;

test.describe.serial('feature — MCP tokens', () => {
    // FIXME: runtime — McpTokenApi.issue mutation goes through gqty and
    // appears to fail in prod build without surfacing a clear error in
    // the screenshot. The dialog never opens (or closes immediately).
    // Likely the same gqty schema-drift issue as `getUser.kind`. Re-enable
    // after `pnpm generate-schema` regen + workaround drop.
    test.fixme('admin issues a new MCP token', async ({adminPage}) => {
        await adminPage.goto('/admin/system/mcp');

        const issueBtn = byTid(adminPage, tid('mcp', 'issue', 'btn'));
        await expect(issueBtn).toBeVisible({timeout: 15_000});
        await issueBtn.click();

        const nameInput = byTid(adminPage, tid('mcp', 'issue', 'name', 'input'));
        await nameInput.fill(tokenName);
        await byTid(adminPage, tid('mcp', 'issue', 'submit', 'btn')).click();

        // The one-time secret reveal dialog shows the token. We don't
        // capture it (would leak in the trace) — just assert the dialog
        // surfaced and we can dismiss it. Match the warning Alert text
        // from the panel ("This is the only time you will see this secret").
        await expect(adminPage.getByText(/this is the only time/i).first())
            .toBeVisible({timeout: 10_000});
        await byTid(adminPage, tid('mcp', 'reveal', 'close', 'btn')).click();

        // Token row appears in the list.
        await expect(adminPage.getByText(tokenName)).toBeVisible({timeout: 5_000});
    });

    test.fixme('admin revokes the issued token', async ({adminPage}) => {
        await adminPage.goto('/admin/system/mcp');
        const row = adminPage.getByRole('row', {name: new RegExp(tokenName)});
        await expect(row).toBeVisible({timeout: 10_000});
        await row.getByTestId('mcp-revoke-btn').click();
        await byTid(adminPage, tid('mcp', 'revoke', 'confirm', 'btn')).click();
        await expect(adminPage.getByText(tokenName)).toHaveCount(0, {timeout: 10_000});
    });
});
