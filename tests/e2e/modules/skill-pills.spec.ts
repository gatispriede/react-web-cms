import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('skill-pills');

test.describe.serial('module — SkillPills admin + client', () => {
    test('admin authors a SkillPills block on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.SkillPills);
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the SkillPills marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
