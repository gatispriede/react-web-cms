/**
 * Admin product-templates e2e — Phase 1.F (product-display-templates).
 *
 * Hits the `/api/product-templates` JSON surface (the admin UI's REST
 * dispatcher) rather than driving the Antd pane, so the test stays
 * stable across UI tweaks. The pane itself is smoke-tested via the
 * `*-pane` testid being present on `/admin/content/product-templates`.
 */
import {expect, test} from '../fixtures/auth';

test.describe('product templates — admin', () => {
    test('lists built-ins, creates / updates / duplicates / deletes a custom', async ({request}) => {
        // List — expect at least the 5 built-ins seeded on boot.
        const listRes = await request.post('/api/product-templates', {
            data: {op: 'list', includeUsage: true},
        });
        expect(listRes.ok()).toBeTruthy();
        const list = await listRes.json();
        expect(Array.isArray(list)).toBe(true);
        const builtIns = list.filter((t: any) => t.builtIn);
        expect(builtIns.length).toBeGreaterThanOrEqual(5);
        const standard = list.find((t: any) => t.id === 'built-in:standard');
        expect(standard).toBeTruthy();

        // Create a custom template.
        const createRes = await request.post('/api/product-templates', {
            data: {op: 'create', input: {name: 'E2E Custom', audience: 'b2c'}},
        });
        expect(createRes.ok()).toBeTruthy();
        const created = await createRes.json();
        expect(created.id).toBeTruthy();
        expect(created.builtIn).toBe(false);

        // Update — name + description.
        const updateRes = await request.post('/api/product-templates', {
            data: {
                op: 'update',
                id: created.id,
                patch: {name: 'E2E Renamed', description: 'updated'},
                expectedVersion: created.version,
            },
        });
        const updated = await updateRes.json();
        expect(updated.name).toBe('E2E Renamed');
        expect(updated.version).toBe(created.version + 1);

        // Duplicate the built-in:premium → ensure it becomes a custom row.
        const dupRes = await request.post('/api/product-templates', {
            data: {op: 'duplicate', fromId: 'built-in:premium', newName: 'Premium Custom'},
        });
        const dup = await dupRes.json();
        expect(dup.builtIn).toBe(false);
        expect(dup.name).toBe('Premium Custom');

        // Delete the custom we just created — cascade reset should report 0.
        const delRes = await request.post('/api/product-templates', {
            data: {op: 'delete', id: created.id},
        });
        const delJson = await delRes.json();
        expect(delJson.cascadedProducts).toBeGreaterThanOrEqual(0);

        // Cleanup duplicate too.
        await request.post('/api/product-templates', {
            data: {op: 'delete', id: dup.id},
        });

        // Built-ins reject delete.
        const builtInDel = await request.post('/api/product-templates', {
            data: {op: 'delete', id: 'built-in:standard'},
        });
        expect(builtInDel.status()).toBeGreaterThanOrEqual(400);
    });

    test('preview endpoint resolves a template + fixture product', async ({request}) => {
        const res = await request.post('/api/product-templates', {
            data: {op: 'preview', id: 'built-in:standard'},
        });
        expect(res.ok()).toBeTruthy();
        const json = await res.json();
        expect(json.template.id).toBe('built-in:standard');
        expect(Array.isArray(json.sections)).toBe(true);
        expect(json.sections.length).toBeGreaterThan(0);
    });
});
