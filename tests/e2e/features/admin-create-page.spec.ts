import {test, expect} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {byTid, tid, moduleTypeSlug} from '../fixtures/testIds';

// The important test — the smallest realistic end-to-end chain that
// proves the canonical authoring path works:
//
//   1. seeded admin signs in via the real form
//   2. admin creates a page through the admin UI
//   3. admin adds one RICH_TEXT module with marker text
//   4. fresh anon browser visits the public URL
//   5. marker text is visible on the rendered page
//   6. admin deletes the page (cleanup through the same UI)
//
// Only the admin user is seeded directly to Mongo. Page, section, module
// — all created through admin clicks, exercising auth + audit + validate
// + revalidate just like a real operator would.
//
// Testids follow `docs/architecture/test-ids.md` —
// `<feature>-<element>[-<context>]-<role>`. Composed inline at each call
// site, no registry.
//
// Gated on `E2E_MODULES_CHAIN_ENABLED=1` until Phase B (data-testid
// instrumentation on the admin shell) lands. Once the testids referenced
// below exist in the JSX, drop the gate and let CI run this on every PR.

test.describe('admin chain — create page with RichText, public render', () => {
    test.skip(
        !process.env.E2E_MODULES_CHAIN_ENABLED,
        'gated on Phase B (data-testid instrumentation per docs/architecture/test-ids.md). ' +
            'Set E2E_MODULES_CHAIN_ENABLED=1 once the testids exist in the admin JSX.',
    );

    test('admin creates a page with a RichText module, public site renders it', async ({
        adminPage,
        anonPage,
        seededAdmin,
    }) => {
        const slug = `rt-${seededAdmin.id.slice(0, 8)}`;
        const marker = `e2e-rt-marker-${seededAdmin.id.slice(0, 6)}`;
        const richTextSlug = moduleTypeSlug(EItemType.RichText);

        try {
            // ── create page ───────────────────────────────────────────
            await adminPage.goto('/admin');
            await byTid(adminPage, tid('nav', 'add', 'page', 'btn')).click();
            await byTid(adminPage, tid('nav', 'page', 'name', 'input')).fill(slug);
            await byTid(adminPage, tid('nav', 'page', 'save', 'btn')).click();
            await expect(byTid(adminPage, tid('nav', 'page', 'row', slug))).toBeVisible({timeout: 15_000});

            // ── add a 1-column section so the page has a slot ────────
            // Newly-created pages render a section-template chooser, not
            // the per-section "add module" trigger. We explicitly create
            // a blank 1-column section first; that's the same path a
            // real operator would take.
            await byTid(adminPage, tid('section', 'add', 'section', 'btn')).click();
            await byTid(adminPage, tid('section', 'layout', 'picker', '1')).click();
            await byTid(adminPage, tid('section', 'create', 'btn')).click();

            // ── add RichText module into the section ─────────────────
            await byTid(adminPage, tid('section', 'add', 'module', 'btn')).click();
            await byTid(adminPage, tid('section', 'module', 'picker', richTextSlug)).click();
            await byTid(adminPage, tid('module-editor', 'primary', 'text', 'input')).fill(marker);
            await byTid(adminPage, tid('module-editor', 'save', 'btn')).click();
            await expect(byTid(adminPage, tid('section', 'module', 'row', richTextSlug))).toBeVisible();

            // Optional section-level save (no-op if the flow auto-saves).
            const sectionSave = byTid(adminPage, tid('section', 'save', 'btn'));
            if (await sectionSave.count()) await sectionSave.click();

            // ── verify on the public site ─────────────────────────────
            await anonPage.goto(`/lv/${slug}`);
            await expect(anonPage.getByText(marker)).toBeVisible({timeout: 15_000});
        } finally {
            // ── cleanup via the admin UI ──────────────────────────────
            // Best-effort — failure here shouldn't mask the real test
            // failure, so we wrap and ignore. seededAdmin is dropped by
            // its own fixture; only the page row is ours to remove.
            try {
                await adminPage.goto('/admin');
                const row = byTid(adminPage, tid('nav', 'page', 'row', slug));
                if (await row.count()) {
                    await row.click();
                    await byTid(adminPage, tid('nav', 'page', 'delete', 'btn')).click();
                    await expect(row).toHaveCount(0, {timeout: 10_000});
                }
            } catch {/* leave the row — test report shows the real failure */}
        }
    });
});
