import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('blog-feed');

test.describe.serial('module — BlogFeed admin + client', () => {
    test('admin sets a BlogFeed heading on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.BlogFeed);
        // BlogFeed's `module-editor-primary-text-input` is the heading.
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the BlogFeed heading', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
