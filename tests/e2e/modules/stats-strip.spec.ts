import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    addStatsStripRow, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('stats-strip');

test.describe.serial('module — StatsStrip admin + client', () => {
    test('admin authors a StatsStrip cell on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.StatsStrip);
        // StatsStrip starts with zero cells; click "Add stat" then fill.
        await addStatsStripRow(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the StatsStrip marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
