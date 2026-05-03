import {test, expect} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {slugifyAnchor} from '@utils/stringFunctions';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer,
} from './_shared/moduleHarness';

// ──────────────────────────────────────────────────────────────────
// MODULE — Timeline anchor links (C13b, shipped 2026-05-03)
//
// FLOW
//   Public render of a Timeline entry exposes an `id` on its `<h3
//   class="timeline__who">` derived from `slugifyAnchor(`${company}-${role}`)`.
//   Visiting the page with that hash should scroll the entry into view.
//
// DATA STATE
//   Spec authors a fresh page + Timeline module with one entry whose
//   primary text (the "company" field, per moduleHarness comment) is the
//   marker. The `role` field is left blank, so the anchor reduces to
//   slugifyAnchor(`${marker}-`) → slugifyAnchor(marker).
//
// SELECTOR GAPS (TODO — link picker integration):
//   - data-testid="link-picker-group-timeline-entries" → the "Timeline
//                entries" group in the link picker (admin-side). Skipped
//                until the picker decorates groups with this testid.
// ──────────────────────────────────────────────────────────────────

const scenario = buildScenario('tl-anchor');

test.describe.serial('module — Timeline anchor scroll', () => {
    test('admin authors a Timeline entry on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.Timeline);
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public hash navigation scrolls to the entry h3', async ({anonPage}) => {
        // marker-only, role blank → anchor is slugifyAnchor(`${marker}-`)
        // which equals slugifyAnchor(marker) (trailing `-` is collapsed).
        const anchor = slugifyAnchor(scenario.marker);
        // Poll for ISR.
        const deadline = Date.now() + 30_000;
        let h3Count = 0;
        while (Date.now() < deadline) {
            await anonPage.goto(`/lv/${scenario.pageSlug}?ts=${Date.now()}#${anchor}`);
            const h3 = anonPage.locator(`h3.timeline__who#${anchor}`);
            h3Count = await h3.count();
            if (h3Count > 0 && await h3.first().isVisible()) {
                // It's in the viewport (browser scrolled to it on hash).
                await expect(h3.first()).toBeInViewport({timeout: 5_000});
                return;
            }
            await anonPage.waitForTimeout(750);
        }
        throw new Error(
            `timeline anchor h3 never rendered for slug "${anchor}" on /lv/${scenario.pageSlug} (h3 count: ${h3Count})`,
        );
    });

    test.skip('admin link picker surfaces the "Timeline entries" group', async ({adminPage}) => {
        // TODO: unskip once data-testid="link-picker-group-timeline-entries"
        // exists. Contract: opening any LinkInput on a different module
        // (e.g. a Hero CTA) should show the Timeline-entries group with
        // the entry authored above as a selectable target.
        const _ = adminPage;
    });
});
