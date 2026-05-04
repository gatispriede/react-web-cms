import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('timeline');

test.describe.serial('module — Timeline admin + client', () => {
    test('admin authors a Timeline entry on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.Timeline);
        // Timeline's `module-editor-primary-text-input` is the first
        // entry's company field.
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the Timeline marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
