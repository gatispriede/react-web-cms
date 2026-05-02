import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('services');

test.describe.serial('module — Services admin + client', () => {
    test('admin authors a Services block on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.Services);
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the Services marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
