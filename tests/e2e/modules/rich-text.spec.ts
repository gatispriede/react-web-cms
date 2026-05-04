import {test, expect} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario,
    createPage,
    addBlankSection,
    openAddModuleDrawer,
    fillPrimaryText,
    saveModuleDrawer,
    assertPublicMarker,
} from './_shared/moduleHarness';

// ──────────────────────────────────────────────────────────────────
// MODULE — RichText
//
// Smallest interesting module: one editable text field, one HTML output.
// Used here as the canonical exemplar for the harness — every other
// "single primary input" module spec follows this exact shape.
//
// What this proves:
//   - admin: page create → section add → RichText add → save
//   - public: marker text shows up at /<lang>/<slug>
//   - HTML escaping path through CKEditor → server → public render
// ──────────────────────────────────────────────────────────────────

const scenario = buildScenario('rich-text');

test.describe.serial('module — RichText admin + client', () => {
    test('admin authors a RichText block on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.RichText);
        // RichText has a hidden mirror textarea with the primary-text
        // testid (see ui/admin/modules/RichText/RichTextEditor.tsx) so
        // Playwright fill goes through the same setContent path the
        // CKEditor user-flow does.
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the RichText marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
