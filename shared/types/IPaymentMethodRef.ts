/**
 * client-account-settings-page — Phase 1.E.
 *
 * Tokenized reference to a saved payment method. We NEVER persist raw
 * card numbers / CVV — `tokenizedId` is the provider's opaque handle
 * (Stripe `pm_…`, PayPal billing-agreement id, Klarna customer-token).
 * The display fields (`last4`, expiry) are operator-displayable
 * surrogates only; the actual charge round-trips back to the provider.
 */

/** Predefined provider enum. Storefront / admin forms render as
 *  constrained `<Select>` with these options — never free text. */
export type PaymentMethodProvider = 'stripe' | 'paypal' | 'klarna';

export interface IPaymentMethodRef {
    /** Local id (guid). Stable across rotation of the provider token. */
    id: string;
    provider: PaymentMethodProvider;
    /** Provider-side opaque handle. Stripe payment-method id, PayPal
     *  billing-agreement id, etc. */
    tokenizedId: string;
    /** UI-only display surrogate. Never relied on for routing /
     *  authorisation. */
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault?: boolean;
    /** ISO-string in transport, `Date` once hydrated. Mongo round-trips
     *  it as `Date` natively. */
    addedAt: Date;
}
