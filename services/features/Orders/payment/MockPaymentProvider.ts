import guid from '@utils/guid';
import type {
    AuthorizeArgs,
    AuthorizeResult,
    CaptureResult,
    IPaymentProvider,
    RefundResult,
} from './IPaymentProvider';

/**
 * In-memory mock provider. Always succeeds except for the canonical
 * "decline" PAN `4000000000000002`. Idempotency keys are cached in a
 * process-local Map so retries within the same process replay the
 * original result rather than calling through twice — matches what a
 * real Stripe-style provider would do via its own idempotency layer.
 */

const DECLINE_CARD = '4000000000000002';

export class MockPaymentProvider implements IPaymentProvider {
    public readonly name = 'mock';
    private cache: Map<string, AuthorizeResult | CaptureResult | RefundResult> = new Map();

    async authorize(args: AuthorizeArgs): Promise<AuthorizeResult> {
        const cached = this.cache.get(`authorize:${args.idempotencyKey}`);
        if (cached) return cached as AuthorizeResult;
        const number = (args.card?.number ?? '').replace(/\s+/g, '');
        let result: AuthorizeResult;
        if (number === DECLINE_CARD) {
            result = {ok: false, declineCode: 'card_declined'};
        } else {
            result = {
                ok: true,
                authorizationId: `mock_auth_${guid()}`,
                last4: number.slice(-4),
                brand: 'mock-visa',
            };
        }
        this.cache.set(`authorize:${args.idempotencyKey}`, result);
        return result;
    }

    async capture(authorizationId: string, idempotencyKey: string): Promise<CaptureResult> {
        const cached = this.cache.get(`capture:${idempotencyKey}`);
        if (cached) return cached as CaptureResult;
        if (!authorizationId) {
            return {ok: false, error: 'missing authorizationId'};
        }
        const result: CaptureResult = {ok: true, captureId: `mock_cap_${guid()}`};
        this.cache.set(`capture:${idempotencyKey}`, result);
        return result;
    }

    async refund(captureId: string, _amount: number, idempotencyKey: string): Promise<RefundResult> {
        const cached = this.cache.get(`refund:${idempotencyKey}`);
        if (cached) return cached as RefundResult;
        if (!captureId) {
            return {ok: false, error: 'missing captureId'};
        }
        const result: RefundResult = {ok: true, refundId: `mock_rfn_${guid()}`};
        this.cache.set(`refund:${idempotencyKey}`, result);
        return result;
    }
}
