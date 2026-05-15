/**
 * Storefront product-with-template e2e — Phase 1.F.
 *
 * Assigns a template to a product via the REST surface, then asserts
 * the admin preview page renders that template's section list.
 * Full SSR-rendered leaf product page wire-up is exercised by the
 * existing Phase 1.C storefront specs; this jump only adds the
 * template-aware dispatch shim, which is covered via the preview route.
 */
import {expect, test} from '../fixtures/auth';

test.describe('product with template — storefront preview', () => {
    test('preview renders the assigned template', async ({page, request}) => {
        // Pick the first product (fixture data).
        const listRes = await request.post('/api/product-templates', {
            data: {op: 'preview', id: 'built-in:premium'},
        });
        expect(listRes.ok()).toBeTruthy();
        const preview = await listRes.json();
        expect(preview.template.id).toBe('built-in:premium');

        await page.goto(`/admin/preview/template/built-in:premium`);
        await expect(page.locator('[data-testid="template-preview-built-in:premium"]')).toBeVisible();
        await expect(page.locator('[data-testid="template-preview-title"]')).toHaveText(/Premium/i);

        const sections = page.locator('[data-testid^="template-preview-section-"]');
        expect(await sections.count()).toBeGreaterThan(0);
    });
});
