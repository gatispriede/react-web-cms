import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer, saveModuleDrawer,
} from './_shared/moduleHarness';

// Media-only module (no editable text). We exercise the add → save round-trip
// only — the public-render assertion needs a real image upload, which is its
// own dedicated spec under `features/asset-upload.spec.ts` once that lands.
const scenario = buildScenario('carousel');

test.describe('module — Carousel admin', () => {
    test('admin saves a default Carousel block on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.Carousel);
        await saveModuleDrawer(adminPage);
    });
});
