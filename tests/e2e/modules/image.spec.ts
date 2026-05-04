import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer, saveModuleDrawer,
} from './_shared/moduleHarness';

// PlainImage's primary content is an image (set via drag-drop / file
// upload), not a text field. Spec exercises the add → save loop without
// a text fill. The asset-upload spec covers the actual image side.
const scenario = buildScenario('image');

test.describe('module — Image (PlainImage) admin', () => {
    test('admin saves a default PlainImage block on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.Image);
        await saveModuleDrawer(adminPage);
    });
});
