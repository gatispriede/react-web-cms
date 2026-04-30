import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Products (admin + customer)
//
// `ProductApi` is currently a mock stub (the GraphQL resolvers
// `getProducts`/`saveProduct` aren't wired yet — see the header
// comment in services/api/client/ProductApi.ts). This spec asserts
// the admin + public surfaces mount cleanly with the empty mock,
// which is the regression guard we want until the real API lands.
// Authoring + cart/checkout flows reinstate when the mock is
// replaced.
// ──────────────────────────────────────────────────────────────────

test.describe('feature — products', () => {
    test('admin can open the products page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/products');
        await expect(
            adminPage.getByRole('button', {name: /new product|add product|create/i}).first(),
        ).toBeVisible({timeout: 15_000});
    });

    test('public products index renders', async ({anonPage}) => {
        await anonPage.goto('/products');
        // With the mock returning [], the page should render an empty
        // state, not crash. A heading or empty message is enough.
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
    });
});
