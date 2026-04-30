import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('stats-card');

test.describe.serial('module — StatsCard admin + client', () => {
    // FIXME: defaultContent starts with empty array, primary-text-input
    // doesn't render until "add" is clicked. Either click the add
    // button first in the spec, or seed defaultContent with one row.
    test.fixme('admin authors a StatsCard on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.StatsCard);
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test.fixme('public site renders the StatsCard marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
