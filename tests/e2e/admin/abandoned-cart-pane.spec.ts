/**
 * Phase 1.B-d — admin abandoned-cart recovery pane smoke spec.
 *
 * Asserts the pane mounts with the three operator-facing controls:
 *   - master `enabled` switch
 *   - delay-minutes Select
 *   - discount-code Input
 *
 * Behaviour (toggle round-trip + table population) is covered by the VM
 * unit tests; this spec just guards the testid contract so a future rename
 * lights up loudly in CI.
 */
import {test, expect} from '../fixtures/auth';
import {byTid} from '../fixtures/testIds';

test.describe('admin — abandoned-cart pane', () => {
    test('renders the three operator controls with stable testids', async ({adminPage}) => {
        await adminPage.goto('/admin/client-config/abandoned-cart');

        const panel = byTid(adminPage, 'abandoned-cart-admin-panel');
        await expect(panel).toBeVisible({timeout: 15_000});

        await expect(byTid(adminPage, 'abandoned-cart-enabled-switch')).toBeVisible();
        await expect(byTid(adminPage, 'abandoned-cart-delay-select')).toBeVisible();
        await expect(byTid(adminPage, 'abandoned-cart-discount-input')).toBeVisible();
    });
});
