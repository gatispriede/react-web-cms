/**
 * Phase 1.B-c — checkout customization.
 *
 * `IPaymentAdapter` — common port every payment provider implements.
 * The `paymentRegistry` collects all enabled adapters at boot; the
 * `CheckoutPaymentForm` module reads the registry to list options
 * and dispatches `processPayment()` on submit.
 *
 * Three production adapters in this jump:
 *   - `stripeAdapter`         (online — card via Stripe)
 *   - `bankTransferAdapter`   (offline — operator IBAN, manual mark-paid)
 *   - `cashOnDeliveryAdapter` (offline — pay on receipt)
 *
 * PayPal + Klarna flags exist on `commerce.checkout.providers.*` so the
 * admin pane shows them, but the adapters aren't wired this jump.
 */

export interface IPaymentInput {
    /** Order id the payment is for. */
    orderId: string;
    /** Amount in minor units of the order currency. */
    amount: number;
    /** ISO 4217 currency code (matches the order). */
    currency: string;
    /** Adapter-specific payload (e.g. Stripe card-token, bank-transfer reference). */
    payload?: Record<string, unknown>;
}

export interface IPaymentResult {
    ok: boolean;
    /** Returned by online providers; `null` for offline adapters. */
    transactionId?: string | null;
    /** Status the order should land in after `processPayment` returns. */
    orderStatusAfter: 'paid' | 'pending-payment' | 'pending-delivery' | 'declined';
    /** Human-readable note rendered on the confirmation page. */
    note?: string;
    error?: string;
    declineCode?: string;
}

export interface IPaymentAdapter {
    /** Stable identifier — matches the `commerce.checkout.providers.<id>` flag suffix. */
    readonly id: 'stripe' | 'bankTransfer' | 'cashOnDelivery' | 'paypal' | 'klarna';
    /** Display label (i18n key resolved upstream). */
    readonly displayName: string;
    /**
     * Returns `true` when the adapter is both (a) flag-enabled in
     * `commerce.checkout.providers.<id>` AND (b) env/config-ready.
     * Stripe double-gates on `STRIPE_SECRET_KEY`; offline adapters
     * only check the flag.
     */
    isEnabled(opts: {flagEnabled: boolean}): boolean;
    /** Run the payment. Caller stamps the result onto the order row. */
    processPayment(input: IPaymentInput): Promise<IPaymentResult>;
}
