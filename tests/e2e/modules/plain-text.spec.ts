import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('plain-text');

test.describe.serial('module — PlainText admin + client', () => {
    test('admin authors a PlainText block on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.Text);
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the PlainText marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
