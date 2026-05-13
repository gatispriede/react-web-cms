import {test as authTest, expect} from '../../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {visualSlotUrl, waitForVisualReady, maskVolatile} from '../_shared/visualHelpers';

/**
 * Commerce first-class theme — per-module visual baselines.
 *
 * Mirrors `tests/e2e/visual/modules/displays.spec.ts` but mounts each
 * module under `[data-theme-name="commerce"]` via the `?theme=commerce`
 * query param the `/dev/visual` slot accepts.
 *
 * Baseline PNGs land under
 * `tests/e2e/visual/__snapshots__/themes/commerce/` so the differ
 * doesn't collide with the default-theme or editorial baselines.
 * Capture path:
 *
 *   npx playwright test --project=visual tests/e2e/visual/themes/commerce.spec.ts --update-snapshots
 *
 * Module coverage matches `EItemType` enum minus `Empty`. Adding a new
 * `EItemType` automatically pulls into this spec via `Object.values()`.
 */

const MODULE_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);

authTest.describe('visual — commerce theme module displays', () => {
    for (const type of MODULE_TYPES) {
        authTest(`commerce · display · ${type}`, async ({anonPage: page}) => {
            await page.goto(visualSlotUrl({type, theme: 'commerce'}));
            const slot = page.getByTestId('visual-slot');
            await expect(slot).toBeVisible({timeout: 30_000});
            await expect(slot).toHaveAttribute('data-theme-name', 'commerce');
            await waitForVisualReady(page);
            await expect(slot).toHaveScreenshot(`commerce-display-${type.toLowerCase()}.png`, {
                mask: maskVolatile(page),
            });
        });
    }
});
