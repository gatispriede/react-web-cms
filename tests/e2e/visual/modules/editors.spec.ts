import {test, expect} from '../../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {visualSlotUrl, waitForVisualReady, maskVolatile} from '../_shared/visualHelpers';

/**
 * Module Editor baselines — one snapshot per `EItemType` (excluding `Empty`).
 *
 * Renders the registry's `Editor` for each type with the registry's
 * `defaultContent` (i.e. the freshly-added-module empty state) — the same
 * shape an admin sees right after picking the type from the module picker.
 *
 * The `/dev/visual?editor=1&type=<EItemType>` route mounts just the editor;
 * we don't drive the admin Build surface + open-drawer flow here because
 * those would multiply navigation cost by 24 for no extra coverage. The
 * full open-drawer flow is exercised by the per-module behaviour specs in
 * `tests/e2e/modules/`.
 */

const MODULE_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);

test.describe('visual — module editors', () => {
    for (const type of MODULE_TYPES) {
        test(`editor · ${type}`, async ({adminPage: page}) => {
            await page.goto(visualSlotUrl({type, editor: true}));
            const slot = page.getByTestId('visual-slot');
            await expect(slot).toBeVisible({timeout: 30_000});
            await waitForVisualReady(page);
            await expect(slot).toHaveScreenshot(`editor-${type.toLowerCase()}.png`, {
                mask: maskVolatile(page),
            });
        });
    }
});
