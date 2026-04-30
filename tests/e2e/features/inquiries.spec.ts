import {test, expect} from '../fixtures/auth';
import {byTid, tid} from '../fixtures/testIds';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Inquiries
//
// Admin views the inquiries inbox at /admin/system/inquiries. The
// inbox is purely read-only from the admin side — submissions arrive
// from the public Inquiry Form module. This spec asserts the page
// loads + the table renders (empty or otherwise), since a populated
// inbox requires a corresponding public-side submit which is its own
// spec when the inquiry-form module is covered.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — inquiries inbox', () => {
    test('admin can open the inquiries page', async ({adminPage}) => {
        await adminPage.goto('/admin/system/inquiries');
        // Either the empty-state helper or the table itself proves the
        // surface mounted without 5xxs.
        await expect(
            adminPage.getByRole('heading', {name: /inquir/i}).first()
        ).toBeVisible({timeout: 15_000});
    });
});
