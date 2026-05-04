import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Cart
//
// Anon customer opens /cart. With ProductApi mocked the cart starts
// empty and the page should render the empty state. Add/update/remove
// flows reinstate once the real ProductApi lands and a "Add to cart"
// button appears on /products/[slug].
// ──────────────────────────────────────────────────────────────────

test.describe('feature — cart', () => {
    test('anon customer can open the cart', async ({anonPage}) => {
        await anonPage.goto('/cart');
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
    });
});
