import {test as authTest, expect} from '../../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {visualSlotUrl, waitForVisualReady, maskVolatile} from '../_shared/visualHelpers';

/**
 * Agency first-class theme — per-module visual baselines.
 *
 * Walks every `EItemType` (minus Empty) under
 * `[data-theme-name="agency"]`. Baseline PNGs land under
 * `tests/e2e/visual/__snapshots__/themes/agency/`.
 *
 * Capture: npx playwright test --project=visual tests/e2e/visual/themes/agency.spec.ts --update-snapshots
 */

const MODULE_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);

authTest.describe('visual — agency theme module displays', () => {
    for (const type of MODULE_TYPES) {
        authTest(`agency · display · ${type}`, async ({anonPage: page}) => {
            await page.goto(visualSlotUrl({type, theme: 'agency'}));
            const slot = page.getByTestId('visual-slot');
            await expect(slot).toBeVisible({timeout: 30_000});
            await expect(slot).toHaveAttribute('data-theme-name', 'agency');
            await waitForVisualReady(page);
            await expect(slot).toHaveScreenshot(`agency-display-${type.toLowerCase()}.png`, {
                mask: maskVolatile(page),
            });
        });
    }
});
