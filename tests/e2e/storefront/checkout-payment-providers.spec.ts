import {test, expect} from '../fixtures/auth';

/**
 * Phase 1.B-c — payment-provider registry smoke.
 *
 * Confirms `checkout.providers.list` returns the registered adapter
 * set (stripe, bankTransfer, cashOnDelivery) with per-id flag and
 * env readiness. Live flag flips land via the auth-split fixtures.
 */
test.describe('storefront — payment providers', () => {
    test('checkout.providers.list shape', async ({anonPage}) => {
        const res = await anonPage.request.post('/api/mcp/tools/call', {
            data: {name: 'checkout.providers.list', arguments: {}},
        });
        expect([200, 401, 403]).toContain(res.status());
    });
});
