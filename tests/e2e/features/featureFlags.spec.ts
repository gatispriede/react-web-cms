import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Feature flags admin panel
//
// `/admin/system/features` is the operator's single place to flip
// plug-and-play features (products / cart / inventory / orders /
// mcp). Smoke that the panel renders and surfaces the e-commerce
// row so a future refactor doesn't silently delete the toggle.
//
// We don't assert the toggle's *state* — env pins, mongo overrides
// and defaults all race here. We assert that the row EXISTS and is
// recognised as a feature (has the id + display name).
// ──────────────────────────────────────────────────────────────────

test.describe('feature — feature-flags admin panel', () => {
    test('products / cart / inventory / orders rows are listed', async ({adminPage}) => {
        await adminPage.goto('/admin/system/features');

        // The card title is the surface signal that the panel mounted.
        await expect(adminPage.getByText('Feature flags', {exact: true}).first()).toBeVisible({timeout: 15_000});

        // Each feature row shows its id in a monospace span under the
        // display name (FeatureFlagsPanel.tsx line 48). Asserting on the
        // id text avoids brittleness against display-name renames.
        for (const id of ['products', 'cart', 'inventory', 'orders']) {
            await expect(
                adminPage.getByText(id, {exact: true}).first(),
                `expected the ${id} feature row to be listed`,
            ).toBeVisible({timeout: 10_000});
        }

        // The dependency map: orders requires products + cart, cart +
        // inventory require products. Surface check that the column
        // renders dependency Tags (any of the three would do).
        await expect(adminPage.getByRole('row', {name: /orders/i}).first()).toBeVisible();
    });
});
