import {test, expect} from '../../fixtures/auth';
import {EItemType} from '@enums/EItemType';
import {visualSlotUrl, waitForVisualReady, maskVolatile} from '../_shared/visualHelpers';

/**
 * Module Display baselines — one snapshot per `EItemType` (excluding `Empty`).
 *
 * Each test navigates to `/dev/visual?type=<EItemType>` which mounts JUST the
 * Display component against the canonical sample fixture from
 * `ui/client/lib/preview/samples.ts`. No admin shell, no theme toggle, no
 * collapse panel — the snapshot is bounded to the module's own DOM.
 *
 * Adding a new `EItemType`: as long as `samples.ts` has at least one
 * fixture for it (the existing samples-coverage test enforces that), this
 * spec automatically picks it up — no edit here.
 */

const MODULE_TYPES = Object.values(EItemType).filter((v) => v !== EItemType.Empty);

test.describe('visual — module displays', () => {
    for (const type of MODULE_TYPES) {
        test(`display · ${type}`, async ({anonPage: page}) => {
            await page.goto(visualSlotUrl({type}));
            const slot = page.getByTestId('visual-slot');
            await expect(slot).toBeVisible({timeout: 30_000});
            await waitForVisualReady(page);
            await expect(slot).toHaveScreenshot(`display-${type.toLowerCase()}.png`, {
                mask: maskVolatile(page),
            });
        });
    }
});
