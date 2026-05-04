import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — SEO
//
// The SEO surface is read-mostly from the admin side: it shows the
// site-wide SEO defaults and the per-page overrides table. This spec
// asserts the page loads cleanly. Edits per page are covered indirectly
// by the page-create flow (which carries SEO fields in the dialog) and
// by SiteFlagsService unit tests.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — SEO admin', () => {
    test('admin can open the SEO page', async ({adminPage}) => {
        await adminPage.goto('/admin/seo');
        // SEO surface uses an info Alert + label-text inputs (no semantic
        // heading). The "These defaults are used when..." Alert is unique
        // to this page; matching its prefix is robust enough.
        await expect(
            adminPage.getByText(/These defaults are used/i).first()
        ).toBeVisible({timeout: 15_000});
    });
});
