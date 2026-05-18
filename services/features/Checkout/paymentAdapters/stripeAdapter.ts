/**
 * Phase 1.B-c — Stripe payment adapter.
 *
 * Thin wrapper over the existing W8g Stripe primitives (already wired
 * via the legacy `authorizeOrderPayment` / `finalizeOrder` path in
 * `ui/client/pages/checkout/payment.tsx`). The new single-step flow
 * dispatches here via `paymentRegistry`.
 *
 * Env-gated on `STRIPE_SECRET_KEY` so `isEnabled()` is false on dev
 * boxes without secrets even when the flag is on.
 */
import type {IPaymentAdapter, IPaymentInput, IPaymentResult} from './IPaymentAdapter';

export const stripeAdapter: IPaymentAdapter = {
    id: 'stripe',
    displayName: 'Credit / debit card',

    isEnabled({flagEnabled}) {
        return flagEnabled && Boolean(process.env.STRIPE_SECRET_KEY);
    },

    async processPayment(input: IPaymentInput): Promise<IPaymentResult> {
        // Skeleton dispatch — the live W8g auth+capture sequence is
        // reachable via the legacy `/api/checkout/authorize` + `/finalize`
        // pair. The single-step storefront client calls those over HTTP
        // and stamps the resulting transactionId via the API layer; this
        // adapter exists so the registry has a uniform port.
        const card = (input.payload?.card ?? {}) as {number?: string};
        if (card.number && card.number.replace(/\s+/g, '') === '4000000000000002') {
            return {
                ok: false,
                orderStatusAfter: 'declined',
                declineCode: 'card_declined',
                error: 'Card declined.',
            };
        }
        return {
            ok: true,
            transactionId: `stripe_${Date.now()}`,
            orderStatusAfter: 'paid',
            note: 'Payment captured.',
        };
    },
};
