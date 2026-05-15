import {test as authTest, expect} from '../../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {visualSlotUrl, waitForVisualReady, maskVolatile} from '../_shared/visualHelpers';

/**
 * Restaurant first-class theme — per-module visual baselines.
 *
 * Walks every `EItemType` (minus Empty) under
 * `[data-theme-name="restaurant"]`. Baseline PNGs land under
 * `tests/e2e/visual/__snapshots__/themes/restaurant/`.
 *
 * Capture: npx playwright test --project=visual tests/e2e/visual/themes/restaurant.spec.ts --update-snapshots
 */

const MODULE_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);

authTest.describe('visual — restaurant theme module displays', () => {
    for (const type of MODULE_TYPES) {
        authTest(`restaurant · display · ${type}`, async ({anonPage: page}) => {
            await page.goto(visualSlotUrl({type, theme: 'restaurant'}));
            const slot = page.getByTestId('visual-slot');
            await expect(slot).toBeVisible({timeout: 30_000});
            await expect(slot).toHaveAttribute('data-theme-name', 'restaurant');
            await waitForVisualReady(page);
            await expect(slot).toHaveScreenshot(`restaurant-display-${type.toLowerCase()}.png`, {
                mask: maskVolatile(page),
            });
        });
    }
});
