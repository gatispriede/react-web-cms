import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer, saveModuleDrawer,
} from './_shared/moduleHarness';

const scenario = buildScenario('gallery');

test.describe('module — Gallery admin', () => {
    test('admin saves a default Gallery block on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.Gallery);
        await saveModuleDrawer(adminPage);
    });
});
