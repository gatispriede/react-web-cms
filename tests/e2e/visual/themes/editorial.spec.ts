import {test as authTest, expect} from '../../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {visualSlotUrl, waitForVisualReady, maskVolatile} from '../_shared/visualHelpers';

/**
 * Editorial first-class theme — per-module visual baselines.
 *
 * Mirrors `tests/e2e/visual/modules/displays.spec.ts` but mounts each
 * module under `[data-theme-name="editorial"]` via the `?theme=editorial`
 * query param the `/dev/visual` slot now accepts.
 *
 * Baseline PNGs land under
 * `tests/e2e/visual/__snapshots__/themes/editorial/` so the differ
 * doesn't collide with the default-theme baselines. Capture path:
 *
 *   npx playwright test --project=visual tests/e2e/visual/themes/editorial.spec.ts --update-snapshots
 *
 * Module coverage matches `EItemType` enum minus `Empty`. Adding a new
 * `EItemType` automatically pulls into this spec via `Object.values()`.
 */

const MODULE_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);

authTest.describe('visual — editorial theme module displays', () => {
    for (const type of MODULE_TYPES) {
        authTest(`editorial · display · ${type}`, async ({anonPage: page}) => {
            await page.goto(visualSlotUrl({type, theme: 'editorial'}));
            const slot = page.getByTestId('visual-slot');
            await expect(slot).toBeVisible({timeout: 30_000});
            // Belt-and-braces — the slot wrapper should carry the theme attr.
            await expect(slot).toHaveAttribute('data-theme-name', 'editorial');
            await waitForVisualReady(page);
            await expect(slot).toHaveScreenshot(`editorial-display-${type.toLowerCase()}.png`, {
                mask: maskVolatile(page),
            });
        });
    }
});
