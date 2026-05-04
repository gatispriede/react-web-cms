import {test} from '../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {
    buildScenario, createPage, addBlankSection, openAddModuleDrawer,
    fillPrimaryText, saveModuleDrawer, assertPublicMarker,
} from './_shared/moduleHarness';

const scenario = buildScenario('project-card');

test.describe.serial('module — ProjectCard admin + client', () => {
    test('admin authors a ProjectCard title on a fresh page', async ({adminPage}) => {
        await createPage(adminPage, scenario);
        await addBlankSection(adminPage);
        await openAddModuleDrawer(adminPage, EItemType.ProjectCard);
        // ProjectCard's `module-editor-primary-text-input` is the title input.
        await fillPrimaryText(adminPage, scenario.marker);
        await saveModuleDrawer(adminPage);
    });

    test('public site renders the ProjectCard marker', async ({anonPage}) => {
        await assertPublicMarker(anonPage, scenario);
    });
});
