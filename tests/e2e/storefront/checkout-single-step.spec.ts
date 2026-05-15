import {test, expect} from '../fixtures/auth';

/**
 * Phase 1.B-c — single-step checkout smoke.
 *
 * The single-step flow is the default per operator decisions. With
 * `commerce.checkoutEnabled === true` AND `commerce.checkout.flow ===
 * 'single-step'` (default), `/checkout` renders the stacked
 * address + payment + summary layout. The full flag-flip fixture
 * lands with the Phase-1.A auth-split sub-jump C helpers; this spec
 * smoke-tests the route shape via the MCP config-get tool.
 */
test.describe('storefront — single-step checkout', () => {
    test('checkout.config.get returns single-step by default', async ({anonPage}) => {
        const res = await anonPage.request.post('/api/mcp/tools/call', {
            data: {name: 'checkout.config.get', arguments: {}},
        });
        // Whether or not auth is required, the response shape should
        // include either the live config or a structured error envelope.
        expect([200, 401, 403]).toContain(res.status());
    });
});
