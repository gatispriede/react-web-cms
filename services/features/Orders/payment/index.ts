import type {IPaymentProvider} from './IPaymentProvider';
import {MockPaymentProvider} from './MockPaymentProvider';

export {MockPaymentProvider} from './MockPaymentProvider';
export type {
    IPaymentProvider,
    AuthorizeArgs,
    AuthorizeResult,
    CaptureResult,
    RefundResult,
    CardInput,
} from './IPaymentProvider';

let cached: IPaymentProvider | null = null;

/**
 * Provider factory. `PAYMENT_PROVIDER === 'stripe'` would select a real
 * provider — not implemented in v1, so we throw a clear message rather
 * than silently falling back. Default is the in-process mock.
 */
export function getPaymentProvider(): IPaymentProvider {
    if (cached) return cached;
    if (process.env.PAYMENT_PROVIDER === 'stripe') {
        throw new Error(
            'PAYMENT_PROVIDER=stripe is configured but StripePaymentProvider is not implemented. ' +
            'Unset the env var to fall back to MockPaymentProvider, or implement the Stripe adapter.',
        );
    }
    cached = new MockPaymentProvider();
    return cached;
}

/** Test helper — clears the cached singleton between tests. */
export function _resetPaymentProviderForTests(): void {
    cached = null;
}
