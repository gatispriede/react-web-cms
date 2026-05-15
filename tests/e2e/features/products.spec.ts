import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Products (admin catalogue list)
//
// Minimal smoke for `/admin/content/products`:
//   1. Seed a product via the admin GraphQL endpoint (same session
//      the page uses, so flag-gated resolvers + auth match the UI).
//   2. Navigate to the admin Products pane.
//   3. Assert the seeded product surfaces in the table by testid.
//
// Guards against the bug fixed in `a71ca1f`: the gqty client was
// generated with `FEATURE_PRODUCTS` off, so `query.mongo.getProducts`
// silently returned nothing through the typed proxy and the page
// rendered "No products yet" even when Mongo had rows. A regression
// there would now break this spec.
// ──────────────────────────────────────────────────────────────────

const slug = `e2e-product-${Date.now().toString(36)}`;
const title = 'E2E Test Product';
const sku = `SKU-${Date.now().toString(36).toUpperCase()}`;

test.describe.serial('feature — products', () => {
    test('admin can open the products page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/products');
        await expect(
            adminPage.getByRole('button', {name: /new product|add product|create/i}).first(),
        ).toBeVisible({timeout: 15_000});
    });

    test('seeded product surfaces in the admin catalogue list', async ({adminPage}) => {
        // Land on the page first so subsequent `page.evaluate` fetches
        // ride the admin session cookie.
        await adminPage.goto('/admin/content/products');

        const seedResult = await adminPage.evaluate(async ({slug, title, sku}) => {
            // Cleanup stragglers from prior runs so the row this test
            // asserts on lands on the first page of the AntD table.
            const listResp = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getProducts(includeDrafts: true, limit: 200) } }`}),
            });
            const listJson = await listResp.json();
            const raw = listJson?.data?.mongo?.getProducts;
            const products: Array<{id: string; slug: string}> = raw ? JSON.parse(raw) : [];
            for (const p of products) {
                if (p.slug?.startsWith('e2e-product-')) {
                    await fetch('/api/graphql', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            query: `mutation R($id: String!) { mongo { removeProduct(id: $id) } }`,
                            variables: {id: p.id},
                        }),
                    });
                }
            }
            // Seed the row this test asserts on.
            const saveResp = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    query: `mutation S($product: JSON!) { mongo { saveProduct(product: $product) } }`,
                    variables: {
                        product: {
                            title, slug, sku,
                            price: 1299, currency: 'EUR', stock: 5,
                            draft: true, source: 'manual', categories: ['e2e'],
                        },
                    },
                }),
            });
            const saveJson = await saveResp.json();
            return {errors: saveJson?.errors ?? null, raw: saveJson?.data?.mongo?.saveProduct ?? null};
        }, {slug, title, sku});
        expect(seedResult?.errors, `saveProduct errored: ${JSON.stringify(seedResult)}`).toBeNull();

        // Reload so the freshly-seeded row picks up via the page's own
        // refresh path. Otherwise we'd be relying on the test having
        // already mounted before the seed, which is order-fragile.
        await adminPage.reload();

        // Row testid is `admin-products-row-<slug>` (Products.tsx#onRow).
        const row = adminPage.getByTestId(`admin-products-row-${slug}`);
        await expect(row).toBeVisible({timeout: 15_000});
        await expect(row).toContainText(title);
        await expect(row).toContainText(sku);
    });

    test('public products index renders', async ({anonPage}) => {
        await anonPage.goto('/products');
        await expect(anonPage.locator('body')).toBeVisible({timeout: 15_000});
    });
});
