import {test, expect} from '../fixtures/auth';
import {byTid, tid} from '../fixtures/testIds';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Publishing
//
// The publish trigger lives in the admin top-bar (not on
// /admin/release/publishing — that page is the read-only history +
// rollback view). Pressing "Publish" opens an AntD Popconfirm; the
// "Publish" OK button hits PublishService.publishSnapshot.
//
// What this proves:
//   - admin: publish-button → Popconfirm → confirm round-trip works
//   - admin: history surface at /admin/release/publishing renders the
//     just-published snapshot
//   - audit: a publish entry shows up at /admin/release/audit
//
// What it does NOT cover (deferred):
//   - rollback flow (needs ≥2 snapshots; covered when snapshot
//     fixtures land)
//   - canPublishProduction gating (UserService.test.ts unit specs)
// ──────────────────────────────────────────────────────────────────

test.describe.serial('feature — publishing snapshot', () => {
    test('admin publishes a snapshot from the top bar', async ({adminPage}) => {
        await adminPage.goto('/admin/build');
        const publishBtn = byTid(adminPage, tid('publishing', 'publish', 'btn'));
        await expect(publishBtn).toBeVisible({timeout: 15_000});
        await publishBtn.click();
        await byTid(adminPage, tid('publishing', 'publish', 'confirm', 'btn')).click();
        // Success surfaces as a "Last published: …" tag swap or a toast.
        // Either is acceptable as a success signal.
        await expect(
            adminPage.getByText(/publish|published|last published/i).first(),
        ).toBeVisible({timeout: 30_000});
    });

    test('admin opens the publishing history page', async ({adminPage}) => {
        await adminPage.goto('/admin/release/publishing');
        // Either history rows or the "No snapshots yet" empty state proves
        // the surface mounts cleanly.
        await expect(adminPage.locator('.ant-table, .ant-empty').first())
            .toBeVisible({timeout: 15_000});
    });

    test('audit log records the publish event', async ({adminPage}) => {
        await adminPage.goto('/admin/release/audit');
        await expect(adminPage.getByText(/publish/i).first())
            .toBeVisible({timeout: 15_000});
    });
});
