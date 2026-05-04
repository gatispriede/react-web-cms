/**
 * Payment provider abstraction. The only concrete implementation is
 * `MockPaymentProvider`; a real Stripe provider drops in later by
 * implementing the same interface and being selected via env switch in
 * `./index.ts` — no caller changes.
 */

export interface CardInput {
    number: string;
    exp: string;
    cvc: string;
    name?: string;
}

export interface AuthorizeArgs {
    amount: number;
    currency: string;
    card: CardInput;
    idempotencyKey: string;
    metadata?: Record<string, string>;
}

export interface AuthorizeResult {
    ok: boolean;
    authorizationId?: string;
    declineCode?: string;
    last4?: string;
    brand?: string;
}

export interface CaptureResult {
    ok: boolean;
    captureId?: string;
    error?: string;
}

export interface RefundResult {
    ok: boolean;
    refundId?: string;
    error?: string;
}

export interface IPaymentProvider {
    name: 'mock' | 'stripe';
    authorize(args: AuthorizeArgs): Promise<AuthorizeResult>;
    capture(authorizationId: string, idempotencyKey: string): Promise<CaptureResult>;
    refund(captureId: string, amount: number, idempotencyKey: string): Promise<RefundResult>;
}
