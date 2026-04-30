import {beforeEach, describe, expect, it} from 'vitest';
import {MockPaymentProvider} from '@services/features/Orders/payment/MockPaymentProvider';

describe('MockPaymentProvider', () => {
    let provider: MockPaymentProvider;

    beforeEach(() => {
        provider = new MockPaymentProvider();
    });

    it('authorize succeeds for normal cards and returns last4 + brand', async () => {
        const res = await provider.authorize({
            amount: 1000,
            currency: 'USD',
            card: {number: '4242424242424242', exp: '12/30', cvc: '123'},
            idempotencyKey: 'k1',
        });
        expect(res.ok).toBe(true);
        expect(res.authorizationId).toMatch(/^mock_auth_/);
        expect(res.last4).toBe('4242');
        expect(res.brand).toBe('mock-visa');
    });

    it('authorize declines the canonical 4000…0002 card', async () => {
        const res = await provider.authorize({
            amount: 1000,
            currency: 'USD',
            card: {number: '4000000000000002', exp: '12/30', cvc: '123'},
            idempotencyKey: 'k2',
        });
        expect(res.ok).toBe(false);
        expect(res.declineCode).toBe('card_declined');
        expect(res.authorizationId).toBeUndefined();
    });

    it('authorize is idempotent on a repeated key', async () => {
        const a = await provider.authorize({
            amount: 1000, currency: 'USD',
            card: {number: '4242424242424242', exp: '12/30', cvc: '123'},
            idempotencyKey: 'same',
        });
        const b = await provider.authorize({
            amount: 1000, currency: 'USD',
            card: {number: '4242424242424242', exp: '12/30', cvc: '123'},
            idempotencyKey: 'same',
        });
        expect(b).toEqual(a);
    });

    it('capture returns a captureId and is idempotent', async () => {
        const a = await provider.capture('mock_auth_x', 'cap1');
        const b = await provider.capture('mock_auth_x', 'cap1');
        expect(a.ok).toBe(true);
        expect(a.captureId).toMatch(/^mock_cap_/);
        expect(b.captureId).toBe(a.captureId);
    });

    it('refund returns a refundId and is idempotent', async () => {
        const a = await provider.refund('mock_cap_x', 500, 'r1');
        const b = await provider.refund('mock_cap_x', 500, 'r1');
        expect(a.ok).toBe(true);
        expect(a.refundId).toMatch(/^mock_rfn_/);
        expect(b.refundId).toBe(a.refundId);
    });
});
