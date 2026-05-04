import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('social-links');

test.describe.serial('module — SocialLinks admin + client', () => {
    test('admin authors a SocialLinks entry on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.SocialLinks);
        // First link's label is the canonical primary-text-input.
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the SocialLinks marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
