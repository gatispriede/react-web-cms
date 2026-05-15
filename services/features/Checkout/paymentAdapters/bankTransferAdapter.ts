/**
 * Phase 1.B-c — Bank-transfer (offline) payment adapter.
 *
 * Pure-offline. On submit:
 *   - Order status → `pending-payment`.
 *   - Confirmation page renders the operator IBAN + the order id as
 *     the payment reference.
 *   - Admin manually marks the order paid once the bank statement
 *     shows the transfer (existing OrdersService `markPaid` flow).
 */
import type {IPaymentAdapter, IPaymentInput, IPaymentResult} from './IPaymentAdapter';

export const bankTransferAdapter: IPaymentAdapter = {
    id: 'bankTransfer',
    displayName: 'Bank transfer',

    isEnabled({flagEnabled}) {
        return flagEnabled;
    },

    async processPayment(input: IPaymentInput): Promise<IPaymentResult> {
        return {
            ok: true,
            transactionId: null,
            orderStatusAfter: 'pending-payment',
            note: `Order placed. Transfer ${input.amount / 100} ${input.currency} to the IBAN shown on the confirmation page; reference: ${input.orderId}.`,
        };
    },
};
