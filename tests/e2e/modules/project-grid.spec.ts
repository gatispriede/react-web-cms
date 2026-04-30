import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('project-grid');

test.describe.serial('module — ProjectGrid admin + client', () => {
    // FIXME: defaultContent starts with empty array, primary-text-input
    // doesn't render until "add" is clicked. Either click the add
    // button first in the spec, or seed defaultContent with one row.
    test.fixme('admin authors a ProjectGrid item on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.ProjectGrid);
        // ProjectGrid's `module-editor-primary-text-input` is the first
        // item's title.
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test.fixme('public site renders the ProjectGrid marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
